// Low-level Gemini client + the original hard-coded 2-step chain (used as a
// fallback if the prompt_chains tables are empty or missing).
//   step 1: image  -> describeImage()  -> plain-text description
//   step 2: text   -> writeCaptions()  -> list of funny captions

const API = "https://generativelanguage.googleapis.com/v1beta/models";

// First model that works wins. Override with GEMINI_MODEL in env if needed.
export const DEFAULT_MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-2.5-flash"].filter(Boolean) as string[];

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export type GenResult = {
    text: string;
    model: string;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
};

export const JSON_LIST_CONFIG = {
    responseMimeType: "application/json",
    responseSchema: { type: "ARRAY", items: { type: "STRING" } },
};

export async function generateWith(models: string[], parts: Part[], generationConfig?: object, apiKeyEnv = "GEMINI_API_KEY"): Promise<GenResult> {
    const key = process.env[apiKeyEnv];
    if (!key) throw new Error(`${apiKeyEnv} is not set`);

    let lastError = "";
    for (const model of models) {
        const t0 = Date.now();
        const res = await fetch(`${API}/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
        });

        if (res.status === 404) {
            lastError = `Model ${model} not found`;
            continue; // try the next model
        }

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? `Gemini error ${res.status}`);

        const text: string | undefined = json?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? "")
            .join("")
            .trim();
        if (!text) throw new Error("Gemini returned an empty response");

        return {
            text,
            model,
            latencyMs: Date.now() - t0,
            inputTokens: json?.usageMetadata?.promptTokenCount,
            outputTokens: json?.usageMetadata?.candidatesTokenCount,
        };
    }
    throw new Error(lastError || "No Gemini model available");
}

export function parseCaptionList(raw: string, max = 5): string[] {
    let captions: unknown;
    try {
        captions = JSON.parse(raw);
    } catch {
        captions = raw.split("\n");
    }
    if (!Array.isArray(captions)) throw new Error("Could not read captions from the model");
    return captions
        .map((c) => String(c).replace(/^["\s*-]+|["\s]+$/g, "").trim())
        .filter((c) => c.length > 0)
        .map((c) => c.slice(0, 300))
        .slice(0, max);
}

export async function describeImage(base64: string, mimeType: string): Promise<string> {
    const r = await generateWith(DEFAULT_MODELS, [
        { inline_data: { mime_type: mimeType, data: base64 } },
        {
            text:
                "Describe this image in 3-5 vivid sentences for a comedy writer who cannot see it. " +
                "Cover who/what is in it, expressions, body language, setting, and anything odd, " +
                "ironic or awkward. Plain text only, no lists.",
        },
    ]);
    return r.text;
}

export async function writeCaptions(description: string): Promise<string[]> {
    const r = await generateWith(
        DEFAULT_MODELS,
        [
            {
                text:
                    "You are a witty meme caption writer. Here is a description of a photo:\n\n" +
                    `"""${description}"""\n\n` +
                    "Write 5 different funny captions for this photo. Mix styles: deadpan, absurd, " +
                    "relatable, wordplay, and one 'when you...' meme format. Each caption under 120 " +
                    "characters, no hashtags, no emojis, nothing mean-spirited or offensive. " +
                    "Return ONLY a JSON array of 5 strings.",
            },
        ],
        { temperature: 1.1, ...JSON_LIST_CONFIG },
    );
    return parseCaptionList(r.text);
}
