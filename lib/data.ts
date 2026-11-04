import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
    is_superadmin?: boolean;
    created_at?: string | null;
    [key: string]: unknown;
};
export type Image = {
    id: string;
    user_id: string;
    storage_path: string;
    image_url: string;
    description: string | null;
    created_at: string;
};
export type Caption = { id: string; image_id: string; user_id: string; content: string; created_at: string };
export type Vote = { id: string; caption_id: string; user_id: string; vote: number; created_at: string };

// Supabase caps a select at 1000 rows, so page through everything.
export async function fetchAll<T>(supabase: SupabaseClient, table: string, columns = "*"): Promise<T[]> {
    const out: T[] = [];
    const size = 1000;
    for (let from = 0; ; from += size) {
        const { data, error } = await supabase
            .from(table)
            .select(columns)
            .order("created_at", { ascending: true })
            .range(from, from + size - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        out.push(...((data ?? []) as T[]));
        if (!data || data.length < size) break;
    }
    return out;
}

export async function loadEverything(supabase: SupabaseClient) {
    const [profiles, images, captions, votes] = await Promise.all([
        fetchAllProfiles(supabase),
        fetchAll<Image>(supabase, "images"),
        fetchAll<Caption>(supabase, "captions"),
        fetchAll<Vote>(supabase, "caption_votes"),
    ]);
    return { profiles, images, captions, votes };
}

// profiles may not have created_at, so don't order by it.
export async function fetchAllProfiles(supabase: SupabaseClient): Promise<Profile[]> {
    const out: Profile[] = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("profiles").select("*").range(from, from + 999);
        if (error) throw new Error(`profiles: ${error.message}`);
        out.push(...((data ?? []) as Profile[]));
        if (!data || data.length < 1000) break;
    }
    return out;
}

export function displayName(p: Profile | undefined, fallbackId?: string) {
    if (!p) return fallbackId ? `user ${fallbackId.slice(0, 6)}` : "unknown";
    const n = [p.first_name, p.last_name].filter(Boolean).join(" ");
    return n || (p.email as string) || `user ${p.id.slice(0, 6)}`;
}

export function fmtDate(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
    });
}
