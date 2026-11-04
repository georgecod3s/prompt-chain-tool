/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/data";
import type { Chain, GenRequest, Model, Step } from "@/lib/types";
import Flash from "@/components/Flash";
import StepFields from "@/components/StepFields";
import SubmitButton from "@/components/SubmitButton";
import { createStep, deleteChain, deleteStep, generateMedia, moveStep, updateChain, updateStep } from "../../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // the generate action runs every step against Gemini

function highlight(prompt: string) {
    return prompt.split(/(\{\{\w+\}\})/g).map((part, i) =>
        /^\{\{\w+\}\}$/.test(part) ? (
            <span key={i} className="rounded bg-accent-soft px-1 text-accent">
                {part}
            </span>
        ) : (
            part
        ),
    );
}

export default async function ChainEditor({ params, searchParams }: PageProps<"/chains/[id]">) {
    const { id } = await params;
    const sp = await searchParams;
    const { supabase } = await requireAdmin();

    const { data: chain } = await supabase.from("prompt_chains").select("*").eq("id", id).maybeSingle<Chain>();
    if (!chain) notFound();

    const [{ data: stepRows }, { data: modelRows }, { data: runRows }] = await Promise.all([
        supabase.from("prompt_chain_steps").select("*").eq("chain_id", id).order("step_order"),
        supabase.from("llm_models").select("*").order("priority"),
        supabase.from("generation_requests").select("*").eq("chain_id", id).order("created_at", { ascending: false }).limit(4),
    ]);
    const steps = (stepRows ?? []) as Step[];
    const models = (modelRows ?? []) as Model[];
    const runs = (runRows ?? []) as GenRequest[];
    const modelName = (mid: number | null) => models.find((m) => m.id === mid)?.name ?? "Default model";
    const imgIds = runs.map((r) => r.image_id).filter(Boolean) as string[];
    const { data: imgs } = imgIds.length ? await supabase.from("images").select("id, image_url").in("id", imgIds) : { data: [] };
    const imgUrl = new Map((imgs ?? []).map((i) => [String(i.id), i.image_url as string]));
    const aiOn = !!process.env.GEMINI_API_KEY;
    const n = steps.length;

    return (
        <div className="space-y-6">
            <Link href="/" className="text-sm text-muted hover:text-fg">← All prompt chains</Link>
            <Flash ok={sp.ok} error={sp.error} />

            {/* ---------------- chain details */}
            <section className="card p-5">
                <form action={updateChain} className="grid gap-4 md:grid-cols-[1fr_2fr_auto]">
                    <input type="hidden" name="id" value={chain.id} />
                    <label className="block text-sm">
                        <span className="text-muted">Chain name *</span>
                        <input name="name" required maxLength={80} defaultValue={chain.name} className="input mt-1 text-base font-semibold" />
                    </label>
                    <label className="block text-sm">
                        <span className="text-muted">Description</span>
                        <input name="description" maxLength={300} defaultValue={chain.description ?? ""} className="input mt-1" />
                    </label>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm">
                        <input type="checkbox" name="is_active" defaultChecked={chain.is_active} className="h-4 w-4 accent-[var(--accent)]" /> Active
                    </label>
                    <div className="flex flex-wrap items-center gap-3 md:col-span-3">
                        <SubmitButton pending="Saving…">Save chain</SubmitButton>
                        <Link href={`/chains/${chain.id}/media`} className="btn btn-ghost">
                            View generated media →
                        </Link>
                        <SubmitButton
                            className="btn btn-danger ml-auto"
                            pending="Deleting…"
                            formAction={deleteChain}
                            confirm={`Delete "${chain.name}" and all ${n} of its steps? Generated photos and captions are kept.`}
                        >
                            Delete chain
                        </SubmitButton>
                    </div>
                    <p className="text-xs text-muted md:col-span-3">
                        #{chain.id} · created {fmtDate(chain.created_at)} · updated {fmtDate(chain.updated_at)}
                    </p>
                </form>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                {/* ---------------- steps */}
                <section className="min-w-0 space-y-4">
                    <div className="flex items-end justify-between">
                        <h2 className="text-xl font-bold">Steps ({n})</h2>
                        <a href="#new-step" className="text-sm font-semibold text-accent hover:underline">＋ Add step</a>
                    </div>

                    <ol className="space-y-4">
                        {steps.map((s, i) => (
                            <li key={s.id} id={`step-${s.id}`} className="card scroll-mt-24 overflow-hidden">
                                {/* header + reorder controls */}
                                <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg">{s.step_order}</span>
                                    <span className="font-semibold">{s.name}</span>
                                    <span className="pill">{s.input_type} → {s.output_type === "json_list" ? "caption list" : "text"}</span>
                                    <span className="pill">{modelName(s.model_id)}</span>
                                    <div className="ml-auto flex items-center gap-1">
                                        <form action={moveStep}>
                                            <input type="hidden" name="id" value={s.id} />
                                            <input type="hidden" name="chain_id" value={chain.id} />
                                            <input type="hidden" name="to" value={s.step_order - 1} />
                                            <button disabled={i === 0} title="Move up" aria-label={`Move step ${s.step_order} up`} className="btn btn-ghost btn-icon disabled:opacity-30">
                                                ↑
                                            </button>
                                        </form>
                                        <form action={moveStep}>
                                            <input type="hidden" name="id" value={s.id} />
                                            <input type="hidden" name="chain_id" value={chain.id} />
                                            <input type="hidden" name="to" value={s.step_order + 1} />
                                            <button disabled={i === n - 1} title="Move down" aria-label={`Move step ${s.step_order} down`} className="btn btn-ghost btn-icon disabled:opacity-30">
                                                ↓
                                            </button>
                                        </form>
                                        <form action={moveStep} className="flex items-center gap-1">
                                            <input type="hidden" name="id" value={s.id} />
                                            <input type="hidden" name="chain_id" value={chain.id} />
                                            <select name="to" defaultValue={s.step_order} aria-label="Move to position" className="input !w-auto !py-1 text-xs">
                                                {steps.map((_, j) => (
                                                    <option key={j} value={j + 1}>
                                                        Step {j + 1}
                                                    </option>
                                                ))}
                                            </select>
                                            <button className="btn btn-ghost btn-icon text-xs">Move</button>
                                        </form>
                                    </div>
                                </div>

                                {/* read view + edit form */}
                                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words bg-code px-4 py-3 font-mono text-xs leading-relaxed">{highlight(s.prompt)}</pre>
                                <details className="border-t border-line px-4 py-3">
                                    <summary className="cursor-pointer text-sm font-semibold text-accent">Edit step</summary>
                                    <form action={updateStep} className="mt-3 space-y-3">
                                        <input type="hidden" name="id" value={s.id} />
                                        <input type="hidden" name="chain_id" value={chain.id} />
                                        <StepFields step={s} models={models} idPrefix={`s${s.id}`} />
                                        <div className="flex flex-wrap items-center gap-3">
                                            <SubmitButton pending="Saving…">Save step</SubmitButton>
                                            <SubmitButton className="btn btn-danger" pending="Deleting…" formAction={deleteStep} confirm={`Delete step ${s.step_order} “${s.name}”?`}>
                                                Delete step
                                            </SubmitButton>
                                            <span className="ml-auto text-xs text-muted">updated {fmtDate(s.updated_at)}</span>
                                        </div>
                                    </form>
                                </details>
                            </li>
                        ))}
                    </ol>
                    {!n && <p className="card p-6 text-center text-sm text-muted">This chain has no steps yet. Add the first one below.</p>}

                    {/* ---------------- new step */}
                    <section id="new-step" className="card scroll-mt-24 border-dashed p-5">
                        <h3 className="mb-3 font-semibold">＋ Add a step</h3>
                        <form action={createStep} className="space-y-3">
                            <input type="hidden" name="chain_id" value={chain.id} />
                            <StepFields step={{ input_type: n ? "text" : "image", output_type: "text" }} models={models} idPrefix="new" />
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-2 text-sm">
                                    <span className="text-muted">Insert at</span>
                                    <select name="position" defaultValue={n + 1} className="input !w-auto">
                                        {Array.from({ length: n + 1 }, (_, j) => (
                                            <option key={j} value={j + 1}>
                                                Step {j + 1}{j === n ? " (end)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <SubmitButton pending="Adding…">Add step</SubmitButton>
                            </div>
                        </form>
                    </section>
                </section>

                {/* ---------------- generate + recent runs */}
                <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                    <section id="generate" className="card scroll-mt-24 p-5">
                        <h2 className="font-semibold">Generate media</h2>
                        <p className="mt-1 text-xs text-muted">
                            Upload a photo and run it through all {n} step{n === 1 ? "" : "s"} of this chain. The photo and captions are saved to Caption Clash.
                        </p>
                        {aiOn ? (
                            <form action={generateMedia} className="mt-4 space-y-3">
                                <input type="hidden" name="chain_id" value={chain.id} />
                                <input type="file" name="image" accept="image/*" required className="input" />
                                <SubmitButton pending={`Running ${n} steps…`} className="btn btn-primary w-full justify-center">
                                    ✨ Run chain
                                </SubmitButton>
                            </form>
                        ) : (
                            <p className="mt-3 rounded-lg bg-danger-soft p-3 text-xs text-danger">Set GEMINI_API_KEY on this Vercel project to enable generation.</p>
                        )}
                        {!n && <p className="mt-2 text-xs text-danger">Add at least one step first.</p>}
                    </section>

                    <section className="card p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="font-semibold">Recent runs</h2>
                            <Link href={`/chains/${chain.id}/media`} className="text-xs font-semibold text-accent hover:underline">See all →</Link>
                        </div>
                        <ul className="space-y-2">
                            {runs.map((r) => (
                                <li key={r.id}>
                                    <Link href={`/runs/${r.id}`} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-surface-2">
                                        {r.image_id && imgUrl.get(String(r.image_id)) ? (
                                            <img src={imgUrl.get(String(r.image_id))} alt="" className="h-10 w-10 rounded-lg object-cover" />
                                        ) : (
                                            <span className="h-10 w-10 rounded-lg bg-surface-2" />
                                        )}
                                        <span className="min-w-0 flex-1 text-xs">
                                            <span className={`font-semibold ${r.status === "failed" ? "text-danger" : r.status === "completed" ? "text-ok" : ""}`}>{r.status}</span>
                                            <span className="block text-muted">{r.caption_count} captions · {fmtDate(r.created_at)}</span>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                            {!runs.length && <li className="text-xs text-muted">Not run yet.</li>}
                        </ul>
                    </section>
                </aside>
            </div>
        </div>
    );
}
