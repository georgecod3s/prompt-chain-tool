import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MODELS, JSON_LIST_CONFIG, generateWith, parseCaptionList, type Part } from "./gemini";
import type { Chain, Model, Step } from "./types";

// Runs ONE specific prompt chain, step by step:
//   - image steps get the uploaded photo + their prompt
//   - text steps get their prompt with placeholders filled in:
//       {{previous}}     output of the step right before
//       {{step1}} {{step2}} …  output of any earlier step
//       {{description}}  output of the first text-producing step
//       {{terms}} {{examples}}  active rows from those tables
//   - the LAST step's output becomes the captions (JSON list, or one per line)
// Every run is logged to generation_requests, and every model call to llm_responses.

const isGemini = (m?: Model) => !!m && /gemini|google|generativelanguage/i.test(`${m.llm_providers?.name ?? ""} ${m.llm_providers?.base_url ?? ""}`);

export type StepOutput = { step: Step; model: string; text: string; ms: number };

export async function runChain(opts: {
    supabase: SupabaseClient;
    userId: string;
    chain: Chain;
    imageId: string;
    image: { base64: string; mime: string };
    source?: string;
}): Promise<{ requestId: number | null; captions: string[]; description: string; outputs: StepOutput[] }> {
    const { supabase, chain } = opts;

    const [{ data: stepRows, error: stepErr }, { data: modelRows }, { data: termRows }, { data: exRows }] = await Promise.all([
        supabase.from("prompt_chain_steps").select("*").eq("chain_id", chain.id).order("step_order"),
        supabase.from("llm_models").select("*, llm_providers(*)").eq("is_active", true).order("priority"),
        supabase.from("terms").select("term, definition").eq("is_active", true).order("term"),
        supabase
            .from("ai_generation_examples")
            .select("image_description, caption")
            .eq("is_active", true)
            .or(`chain_id.is.null,chain_id.eq.${chain.id}`)
            .limit(8),
    ]);
    if (stepErr) throw new Error(stepErr.message);
    const steps = (stepRows ?? []) as Step[];
    if (!steps.length) throw new Error("This chain has no steps yet");

    const models = ((modelRows ?? []) as Model[]).filter((m) => m.llm_providers?.is_active !== false);
    const termsText = termRows?.length
        ? "Campus terms you may use if they fit:\n" + (termRows as { term: string; definition: string }[]).map((t) => `- ${t.term}: ${t.definition}`).join("\n")
        : "";
    const examplesText = exRows?.length
        ? "Examples of captions people loved:\n" +
          (exRows as { image_description: string; caption: string }[]).map((e) => `Photo: ${e.image_description}\nCaption: ${e.caption}`).join("\n\n")
        : "";

    const { data: req } = await supabase
        .from("generation_requests")
        .insert({ chain_id: chain.id, chain_name: chain.name, requested_by: opts.userId, image_id: opts.imageId, source: opts.source ?? "prompt-chain-tool" })
        .select("id")
        .single();
    const requestId: number | null = req?.id ?? null;

    const outputs: StepOutput[] = [];
    let description = "";

    try {
        for (const [i, step] of steps.entries()) {
            const previous = outputs[i - 1]?.text ?? "";
            let prompt = step.prompt
                .replaceAll("{{previous}}", previous)
                .replaceAll("{{description}}", description || previous)
                .replaceAll("{{terms}}", termsText)
                .replaceAll("{{examples}}", examplesText);
            outputs.forEach((o, j) => (prompt = prompt.replaceAll(`{{step${j + 1}}}`, o.text)));
            prompt = prompt.replace(/\n{3,}/g, "\n\n").trim();

            const chosen = models.find((m) => m.id === step.model_id);
            if (chosen && !isGemini(chosen)) throw new Error(`Step ${i + 1}: provider "${chosen.llm_providers?.name}" isn't supported yet (Gemini only)`);
            const ordered = [chosen, ...models.filter((m) => m.id !== step.model_id)].filter(isGemini) as Model[];
            const lead = ordered[0];
            const modelIds = ordered.length ? ordered.map((m) => m.model_id) : DEFAULT_MODELS;

            const parts: Part[] = [];
            if (step.input_type === "image") parts.push({ inline_data: { mime_type: opts.image.mime, data: opts.image.base64 } });
            parts.push({ text: prompt });
            const config = {
                temperature: step.temperature ?? lead?.temperature ?? 1,
                ...(lead?.max_output_tokens ? { maxOutputTokens: lead.max_output_tokens } : {}),
                ...(step.output_type === "json_list" ? JSON_LIST_CONFIG : {}),
            };

            try {
                const r = await generateWith(modelIds, parts, config, lead?.llm_providers?.api_key_env || "GEMINI_API_KEY");
                await supabase.from("llm_responses").insert({
                    request_id: requestId,
                    step_id: step.id,
                    step_order: i + 1,
                    model_id: ordered.find((m) => m.model_id === r.model)?.id ?? null,
                    model_name: r.model,
                    prompt: step.input_type === "image" ? `[image]\n${prompt}` : prompt,
                    response: r.text,
                    status: "ok",
                    latency_ms: r.latencyMs,
                    input_tokens: r.inputTokens ?? null,
                    output_tokens: r.outputTokens ?? null,
                });
                outputs.push({ step, model: r.model, text: r.text, ms: r.latencyMs });
                if (!description && step.output_type === "text") description = r.text;
            } catch (e) {
                await supabase.from("llm_responses").insert({
                    request_id: requestId,
                    step_id: step.id,
                    step_order: i + 1,
                    model_id: lead?.id ?? null,
                    model_name: lead?.model_id ?? modelIds[0],
                    prompt,
                    status: "error",
                    error: (e as Error).message,
                });
                throw new Error(`Step ${i + 1} (${step.name}): ${(e as Error).message}`);
            }
        }

        const last = outputs[outputs.length - 1];
        const captions =
            last.step.output_type === "json_list"
                ? parseCaptionList(last.text, 10)
                : last.text
                      .split("\n")
                      .map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").replace(/^"|"$/g, "").trim())
                      .filter(Boolean)
                      .slice(0, 10);

        if (requestId)
            await supabase
                .from("generation_requests")
                .update({ status: "completed", caption_count: captions.length, completed_at: new Date().toISOString() })
                .eq("id", requestId);
        return { requestId, captions, description, outputs };
    } catch (e) {
        if (requestId)
            await supabase
                .from("generation_requests")
                .update({ status: "failed", error: (e as Error).message, completed_at: new Date().toISOString() })
                .eq("id", requestId);
        throw e;
    }
}
