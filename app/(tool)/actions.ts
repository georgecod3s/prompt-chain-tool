"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { runChain } from "@/lib/runner";
import type { Chain } from "@/lib/types";

const BUCKET = "caption-images";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
    const v = str(fd, k);
    return v === "" ? null : Number(v);
};
const go = (path: string, kind: "ok" | "error", msg: string, hash = ""): never =>
    redirect(`${path}?${kind}=${encodeURIComponent(msg)}${hash}`);

function friendly(msg: string) {
    if (/duplicate key.*name/i.test(msg)) return "A chain with that name already exists.";
    if (/check constraint/i.test(msg)) return "One of the values isn't allowed.";
    return msg;
}

// ---------------------------------------------------------------- chains

export async function createChain(fd: FormData) {
    const { supabase } = await requireAdmin();
    const name = str(fd, "name");
    if (!name) go("/", "error", "Give the chain a name");
    const { data, error } = await supabase
        .from("prompt_chains")
        .insert({ name, description: str(fd, "description") || null, is_active: fd.get("is_active") === "on" })
        .select("id")
        .single();
    if (error) go("/", "error", friendly(error.message));

    // optional starter template: the 3-step example chain
    if (fd.get("template") === "on") {
        const { data: model } = await supabase.from("llm_models").select("id").eq("is_active", true).order("priority").limit(1).maybeSingle();
        const m = model?.id ?? null;
        await supabase.from("prompt_chain_steps").insert([
            {
                chain_id: data!.id,
                step_order: 1,
                name: "Describe the image",
                input_type: "image",
                output_type: "text",
                model_id: m,
                temperature: 0.4,
                prompt: "Describe this image in 3-5 vivid sentences for a comedy writer who cannot see it. Cover who/what is in it, expressions, setting, and anything odd or ironic. Plain text only.",
            },
            {
                chain_id: data!.id,
                step_order: 2,
                name: "Find the funny",
                input_type: "text",
                output_type: "text",
                model_id: m,
                temperature: 1.0,
                prompt: 'Here is a description of a photo:\n\n"""{{previous}}"""\n\nWrite one short paragraph about what is funny, absurd or relatable about this scene.',
            },
            {
                chain_id: data!.id,
                step_order: 3,
                name: "Write 5 captions",
                input_type: "text",
                output_type: "json_list",
                model_id: m,
                temperature: 1.1,
                prompt: 'Photo: """{{step1}}"""\nWhat\'s funny about it: """{{previous}}"""\n\n{{terms}}\n\n{{examples}}\n\nWrite five short, funny captions (under 100 characters, no hashtags or emojis, nothing mean). Return ONLY a JSON array of 5 strings.',
            },
        ]);
    }
    revalidatePath("/");
    go(`/chains/${data!.id}`, "ok", "Chain created");
}

export async function updateChain(fd: FormData) {
    const { supabase } = await requireAdmin();
    const id = str(fd, "id");
    const name = str(fd, "name");
    if (!name) go(`/chains/${id}`, "error", "Name can't be empty");
    const { error } = await supabase
        .from("prompt_chains")
        .update({ name, description: str(fd, "description") || null, is_active: fd.get("is_active") === "on" })
        .eq("id", id);
    if (error) go(`/chains/${id}`, "error", friendly(error.message));
    revalidatePath("/");
    go(`/chains/${id}`, "ok", "Chain saved");
}

export async function deleteChain(fd: FormData) {
    const { supabase } = await requireAdmin();
    const id = str(fd, "id");
    const { error } = await supabase.from("prompt_chains").delete().eq("id", id);
    if (error) go(`/chains/${id}`, "error", error.message);
    revalidatePath("/");
    go("/", "ok", "Chain deleted (its steps were deleted too; generated media was kept)");
}

// ---------------------------------------------------------------- steps

function stepFields(fd: FormData) {
    const input_type = str(fd, "input_type") === "image" ? "image" : "text";
    const output_type = str(fd, "output_type") === "json_list" ? "json_list" : "text";
    const t = num(fd, "temperature");
    return {
        name: str(fd, "name"),
        input_type,
        output_type,
        model_id: num(fd, "model_id"),
        prompt: str(fd, "prompt"),
        temperature: t === null || Number.isNaN(t) ? null : Math.min(2, Math.max(0, t)),
    };
}

export async function createStep(fd: FormData) {
    const { supabase } = await requireAdmin();
    const chainId = str(fd, "chain_id");
    const f = stepFields(fd);
    if (!f.name || !f.prompt) go(`/chains/${chainId}`, "error", "A step needs a name and a prompt", "#new-step");
    const { data: last } = await supabase
        .from("prompt_chain_steps")
        .select("step_order")
        .eq("chain_id", chainId)
        .order("step_order", { ascending: false })
        .limit(1)
        .maybeSingle();
    const { data, error } = await supabase
        .from("prompt_chain_steps")
        .insert({ ...f, chain_id: chainId, step_order: (last?.step_order ?? 0) + 1 })
        .select("id")
        .single();
    if (error) go(`/chains/${chainId}`, "error", friendly(error.message), "#new-step");

    // optional: insert at a specific position
    const pos = num(fd, "position");
    if (pos && data) await supabase.rpc("move_prompt_chain_step", { p_step_id: data.id, p_new_order: pos });

    revalidatePath(`/chains/${chainId}`);
    go(`/chains/${chainId}`, "ok", "Step added", `#step-${data!.id}`);
}

export async function updateStep(fd: FormData) {
    const { supabase } = await requireAdmin();
    const id = str(fd, "id");
    const chainId = str(fd, "chain_id");
    const f = stepFields(fd);
    if (!f.name || !f.prompt) go(`/chains/${chainId}`, "error", "A step needs a name and a prompt", `#step-${id}`);
    const { error } = await supabase.from("prompt_chain_steps").update(f).eq("id", id);
    if (error) go(`/chains/${chainId}`, "error", friendly(error.message), `#step-${id}`);
    revalidatePath(`/chains/${chainId}`);
    go(`/chains/${chainId}`, "ok", "Step saved", `#step-${id}`);
}

export async function deleteStep(fd: FormData) {
    const { supabase } = await requireAdmin();
    const id = str(fd, "id");
    const chainId = str(fd, "chain_id");
    const { error } = await supabase.from("prompt_chain_steps").delete().eq("id", id);
    if (error) go(`/chains/${chainId}`, "error", error.message);
    await supabase.rpc("renumber_prompt_chain_steps", { p_chain_id: Number(chainId) });
    revalidatePath(`/chains/${chainId}`);
    go(`/chains/${chainId}`, "ok", "Step deleted and the rest renumbered");
}

// REORDER: move a step to a position (up / down buttons and the "move to" picker)
export async function moveStep(fd: FormData) {
    const { supabase } = await requireAdmin();
    const id = str(fd, "id");
    const chainId = str(fd, "chain_id");
    const to = num(fd, "to");
    if (!to) go(`/chains/${chainId}`, "error", "Pick a position");
    const { error } = await supabase.rpc("move_prompt_chain_step", { p_step_id: Number(id), p_new_order: to });
    if (error) go(`/chains/${chainId}`, "error", error.message);
    revalidatePath(`/chains/${chainId}`);
    go(`/chains/${chainId}`, "ok", `Moved to step ${to}`, `#step-${id}`);
}

// ---------------------------------------------------------------- generate

export async function generateMedia(fd: FormData) {
    const { supabase, user } = await requireAdmin();
    const chainId = str(fd, "chain_id");
    const back = `/chains/${chainId}`;
    if (!process.env.GEMINI_API_KEY) go(back, "error", "GEMINI_API_KEY isn't set on this Vercel project", "#generate");

    const file = fd.get("image") as File | null;
    if (!file || file.size === 0) go(back, "error", "Choose an image", "#generate");
    if (!file!.type.startsWith("image/")) go(back, "error", "That file isn't an image", "#generate");
    if (file!.size > 4.5 * 1024 * 1024) go(back, "error", "Image must be under 4.5 MB", "#generate");

    const { data: chain } = await supabase.from("prompt_chains").select("*").eq("id", chainId).single<Chain>();
    if (!chain) go("/", "error", "Chain not found");

    // 1. store the photo like the public app does
    const bytes = Buffer.from(await file!.arrayBuffer());
    const ext = file!.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/chain-${chainId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: file!.type });
    if (upErr) go(back, "error", `Upload failed: ${upErr.message}`, "#generate");
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { data: image, error: imgErr } = await supabase
        .from("images")
        .insert({ user_id: user.id, storage_path: path, image_url: pub.publicUrl, description: null })
        .select("id")
        .single();
    if (imgErr) go(back, "error", imgErr.message, "#generate");

    // 2. run the chain
    let result: Awaited<ReturnType<typeof runChain>>;
    try {
        result = await runChain({ supabase, userId: user.id, chain: chain!, imageId: image!.id, image: { base64: bytes.toString("base64"), mime: file!.type } });
    } catch (e) {
        revalidatePath(`${back}/media`);
        go(back, "error", (e as Error).message, "#generate");
    }

    // 3. save description + captions, linked to this run
    if (result!.description) await supabase.from("images").update({ description: result!.description }).eq("id", image!.id);
    if (result!.captions.length) {
        const { error } = await supabase.from("captions").insert(
            result!.captions.map((content) => ({ image_id: image!.id, user_id: user.id, content: content.slice(0, 300), generation_request_id: result!.requestId })),
        );
        if (error) go(back, "error", `Captions not saved: ${error.message}`, "#generate");
    }
    revalidatePath(`${back}/media`);
    go(`/runs/${result!.requestId}`, "ok", `Generated ${result!.captions.length} captions`);
}

// delete one generated photo (and its captions) from the media view
export async function deleteMedia(fd: FormData) {
    const { supabase } = await requireAdmin();
    const imageId = str(fd, "image_id");
    const chainId = str(fd, "chain_id");
    const { data: img } = await supabase.from("images").select("storage_path").eq("id", imageId).maybeSingle();
    const { error } = await supabase.from("images").delete().eq("id", imageId);
    if (error) go(`/chains/${chainId}/media`, "error", error.message);
    if (img?.storage_path) await supabase.storage.from(BUCKET).remove([img.storage_path]);
    revalidatePath(`/chains/${chainId}/media`);
    go(`/chains/${chainId}/media`, "ok", "Media deleted");
}
