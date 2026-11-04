/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { fmtDate } from "@/lib/data";
import type { GenRequest } from "@/lib/types";

export function StatusPill({ status }: { status: string }) {
    const cls =
        status === "completed" || status === "ok"
            ? "!border-ok/40 !bg-ok-soft !text-ok"
            : status === "failed" || status === "error"
              ? "!border-danger/40 !bg-danger-soft !text-danger"
              : "";
    return <span className={`pill ${cls}`}>{status}</span>;
}

export default function RunCard({
    run,
    imageUrl,
    captions,
    showChain,
    children,
}: {
    run: GenRequest;
    imageUrl?: string;
    captions: string[];
    showChain?: boolean;
    children?: React.ReactNode;
}) {
    return (
        <article className="card flex flex-col overflow-hidden">
            <Link href={`/runs/${run.id}`} className="block">
                {imageUrl ? (
                    <img src={imageUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-2 text-sm text-muted">Photo deleted</div>
                )}
            </Link>
            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-center gap-2 text-xs">
                    <StatusPill status={run.status} />
                    {showChain && <span className="truncate font-semibold">{run.chain_name}</span>}
                    <span className="ml-auto text-muted">{fmtDate(run.created_at)}</span>
                </div>
                {run.error && <p className="rounded-lg bg-danger-soft p-2 text-xs text-danger">{run.error}</p>}
                <ul className="space-y-1.5 text-sm">
                    {captions.map((c, i) => (
                        <li key={i} className="rounded-lg bg-surface-2 px-3 py-1.5">“{c}”</li>
                    ))}
                    {!captions.length && !run.error && <li className="text-xs text-muted">No captions saved.</li>}
                </ul>
                <div className="mt-auto flex items-center gap-3 pt-1">
                    <Link href={`/runs/${run.id}`} className="text-xs font-semibold text-accent hover:underline">
                        Step-by-step outputs →
                    </Link>
                    {children}
                </div>
            </div>
        </article>
    );
}
