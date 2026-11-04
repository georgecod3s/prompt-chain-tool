import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/data";
import type { Chain, Step } from "@/lib/types";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { createChain } from "./actions";

export const dynamic = "force-dynamic";

export default async function ChainsPage({ searchParams }: PageProps<"/">) {
    const sp = await searchParams;
    const { supabase } = await requireAdmin();
    const [{ data: chains, error }, { data: steps }, { data: runs }] = await Promise.all([
        supabase.from("prompt_chains").select("*").order("created_at", { ascending: false }),
        supabase.from("prompt_chain_steps").select("id, chain_id, step_order, name, input_type, output_type"),
        supabase.from("generation_requests").select("chain_id, status, image_id").limit(10000),
    ]);

    const stepsFor = (id: number) => ((steps ?? []) as Step[]).filter((s) => s.chain_id === id).sort((a, b) => a.step_order - b.step_order);
    const runsFor = (id: number) => (runs ?? []).filter((r) => r.chain_id === id);

    return (
        <div className="space-y-6">
            <Flash ok={sp.ok} error={sp.error} />
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Prompt chains</h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted">
                        A chain is an ordered list of LLM steps that turns a photo into captions. Open one to edit and reorder its steps, run it on an image,
                        and see everything it has generated.
                    </p>
                </div>
            </header>

            {error && <p className="card p-4 text-sm text-danger">Couldn&apos;t load chains: {error.message}</p>}

            <details className="card p-5" open={!chains?.length}>
                <summary className="cursor-pointer font-semibold text-accent">＋ New prompt chain</summary>
                <form action={createChain} className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm">
                        <span className="text-muted">Name *</span>
                        <input name="name" required maxLength={80} placeholder="e.g. Sarcastic Sports Commentator" className="input mt-1" />
                    </label>
                    <label className="block text-sm">
                        <span className="text-muted">Description</span>
                        <input name="description" maxLength={300} placeholder="What makes this chain different?" className="input mt-1" />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 accent-[var(--accent)]" /> Active
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="template" defaultChecked className="h-4 w-4 accent-[var(--accent)]" />
                        Start with the 3-step template (describe → find the funny → 5 captions)
                    </label>
                    <div className="md:col-span-2">
                        <SubmitButton pending="Creating…">Create chain</SubmitButton>
                    </div>
                </form>
            </details>

            <div className="grid gap-4 md:grid-cols-2">
                {((chains ?? []) as Chain[]).map((c) => {
                    const st = stepsFor(c.id);
                    const r = runsFor(c.id);
                    return (
                        <Link key={c.id} href={`/chains/${c.id}`} className="card group block space-y-4 p-5 transition hover:border-accent">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="truncate text-lg font-semibold group-hover:text-accent">{c.name}</h2>
                                    <p className="line-clamp-2 text-sm text-muted">{c.description || "No description"}</p>
                                </div>
                                <span className={`pill shrink-0 ${c.is_active ? "!border-ok/40 !bg-ok-soft !text-ok" : ""}`}>{c.is_active ? "active" : "inactive"}</span>
                            </div>
                            <ol className="space-y-1.5">
                                {st.map((s) => (
                                    <li key={s.id} className="flex items-center gap-2 text-sm">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">
                                            {s.step_order}
                                        </span>
                                        <span className="truncate">{s.name}</span>
                                        <span className="ml-auto shrink-0 text-xs text-muted">
                                            {s.input_type} → {s.output_type === "json_list" ? "list" : "text"}
                                        </span>
                                    </li>
                                ))}
                                {!st.length && <li className="text-sm text-muted">No steps yet</li>}
                            </ol>
                            <div className="flex justify-between border-t border-line pt-3 text-xs text-muted">
                                <span>
                                    {r.length} run{r.length === 1 ? "" : "s"} · {new Set(r.map((x) => x.image_id).filter(Boolean)).size} photos
                                </span>
                                <span>updated {fmtDate(c.updated_at)}</span>
                            </div>
                        </Link>
                    );
                })}
            </div>
            {!chains?.length && !error && <p className="text-center text-sm text-muted">No chains yet — create your first one above.</p>}
        </div>
    );
}
