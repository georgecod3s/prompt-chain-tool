export default function Flash({ ok, error }: { ok?: string | string[]; error?: string | string[] }) {
    const o = typeof ok === "string" ? ok : undefined;
    const e = typeof error === "string" ? error : undefined;
    if (!o && !e) return null;
    return (
        <div
            role="status"
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${e ? "border-danger/40 bg-danger-soft text-danger" : "border-ok/40 bg-ok-soft text-ok"}`}
        >
            {e ?? o}
        </div>
    );
}
