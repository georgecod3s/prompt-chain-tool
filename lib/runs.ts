import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenRequest } from "./types";

// Loads runs plus their photo and captions.
// Captions are matched by generation_request_id; runs made before that column
// existed fall back to all captions on the run's photo.
export async function loadRuns(supabase: SupabaseClient, filter: { chainId?: string | number; limit?: number }) {
    let q = supabase.from("generation_requests").select("*").order("created_at", { ascending: false }).limit(filter.limit ?? 200);
    if (filter.chainId !== undefined) q = q.eq("chain_id", filter.chainId);
    const { data, error } = await q;
    const runs = (data ?? []) as GenRequest[];

    const imageIds = [...new Set(runs.map((r) => r.image_id).filter(Boolean))] as string[];
    const runIds = runs.map((r) => r.id);
    const [{ data: imgs }, { data: caps }] = await Promise.all([
        imageIds.length ? supabase.from("images").select("id, image_url, description").in("id", imageIds) : Promise.resolve({ data: [] as never[] }),
        imageIds.length
            ? supabase.from("captions").select("content, image_id, generation_request_id, created_at").in("image_id", imageIds).order("created_at")
            : Promise.resolve({ data: [] as never[] }),
    ]);
    const img = new Map(((imgs ?? []) as { id: string; image_url: string; description: string | null }[]).map((i) => [String(i.id), i]));
    const capsByRun = new Map<number, string[]>();
    const capsByImage = new Map<string, string[]>();
    for (const c of (caps ?? []) as { content: string; image_id: string; generation_request_id: number | null }[]) {
        if (c.generation_request_id && runIds.includes(c.generation_request_id)) {
            capsByRun.set(c.generation_request_id, [...(capsByRun.get(c.generation_request_id) ?? []), c.content]);
        }
        capsByImage.set(String(c.image_id), [...(capsByImage.get(String(c.image_id)) ?? []), c.content]);
    }

    return {
        error,
        runs: runs.map((r) => ({
            run: r,
            image: r.image_id ? img.get(String(r.image_id)) : undefined,
            captions: capsByRun.get(r.id) ?? (r.status === "completed" && r.image_id ? (capsByImage.get(String(r.image_id)) ?? []).slice(-r.caption_count || undefined) : []),
        })),
    };
}
