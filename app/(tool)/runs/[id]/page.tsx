/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/data";
import { loadRuns } from "@/lib/runs";
import type { LlmResponse } from "@/lib/types";
import Flash from "@/components/Flash";
import { StatusPill } from "@/components/RunCard";

export const dynamic = "force-dynamic";

export default async function RunDetail({ params, searchParams }: PageProps<"/runs/[id]">) {
    const { id } = await params;
    const sp = await searchParams;
    const { supabase } = await requireAdmin();
    const { data: one } = await supabase.from("generation_requests").select("id, chain_id").eq("id", id).maybeSingle();
    if (!one) notFound();

    const [{ runs }, { data: resp }] = await Promise.all([
        loadRuns(supabase, { chainId: one.chain_id ?? undefined, limit: 500 }),
        supabase.from("llm_responses").select("*").eq("request_id", id).order("step_order").order("created_at"),
    ]);
    const item = runs.find((r) => r.run.id === Number(id));
    if (!item) notFound();
    const { run, image, captions } = item;
    const responses = (resp ?? []) as LlmResponse[];
    const secs = run.completed_at ? ((new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()) / 1000).toFixed(1) : null;

    return (
        <div className="space-y-6">
            {run.chain_id ? (
                <Link href={`/chains/${run.chain_id}/media`} className="text-sm text-muted hover:text-fg">← {run.chain_name} media</Link>
            ) : (
                <Link href="/runs" className="text-sm text-muted hover:text-fg">← All runs</Link>
            )}
            <Flash ok={sp.ok} error={sp.error} />
            <header className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold">Run #{run.id}</h1>
                <StatusPill status={run.status} />
                <span className="text-sm text-muted">
                    {run.chain_id ? <Link href={`/chains/${run.chain_id}`} className="font-semibold text-accent hover:underline">{run.chain_name}</Link> : run.chain_name}
                    {" · "}
                    {fmtDate(run.created_at)}
                    {secs && ` · ${secs}s`}
                </span>
            </header>

            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                <div className="space-y-4">
                    {image ? (
                        <img src={image.image_url} alt="" className="w-full rounded-2xl border border-line object-cover" />
                    ) : (
                        <div className="card flex aspect-[4/3] items-center justify-center text-sm text-muted">Photo deleted</div>
                    )}
                    <section className="card p-4">
                        <h2 className="mb-2 font-semibold">Captions ({captions.length})</h2>
                        <ol className="space-y-1.5 text-sm">
                            {captions.map((c, i) => (
                                <li key={i} className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2">
                                    <span className="font-bold text-accent">{i + 1}.</span> {c}
                                </li>
                            ))}
                        </ol>
                        {run.error && <p className="mt-2 rounded-lg bg-danger-soft p-2 text-xs text-danger">{run.error}</p>}
                    </section>
                </div>

                <section className="min-w-0 space-y-3">
                    <h2 className="text-xl font-bold">Step-by-step</h2>
                    {responses.map((r) => (
                        <div key={r.id} className="card overflow-hidden">
                            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2 text-xs">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">{r.step_order}</span>
                                <StatusPill status={r.status} />
                                <span className="pill">{r.model_name}</span>
                                {r.latency_ms != null && <span className="text-muted">{(r.latency_ms / 1000).toFixed(2)}s</span>}
                                {r.input_tokens != null && <span className="text-muted">{r.input_tokens} → {r.output_tokens} tokens</span>}
                            </div>
                            <details className="border-b border-line px-4 py-2">
                                <summary className="cursor-pointer text-xs font-semibold text-muted">Prompt sent</summary>
                                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted">{r.prompt}</pre>
                            </details>
                            {r.status === "ok" ? (
                                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words bg-code px-4 py-3 font-mono text-xs leading-relaxed">{r.response}</pre>
                            ) : (
                                <p className="px-4 py-3 text-sm text-danger">{r.error}</p>
                            )}
                        </div>
                    ))}
                    {!responses.length && <p className="card p-6 text-sm text-muted">No step outputs were logged for this run.</p>}
                </section>
            </div>
        </div>
    );
}
