import { requireAdmin } from "@/lib/admin";
import { loadRuns } from "@/lib/runs";
import RunCard from "@/components/RunCard";

export const dynamic = "force-dynamic";

export default async function AllRuns() {
    const { supabase } = await requireAdmin();
    const { runs, error } = await loadRuns(supabase, { limit: 120 });
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold">All runs</h1>
                <p className="mt-1 text-sm text-muted">Every prompt chain run across all chains, newest first.</p>
            </header>
            {error && <p className="card p-4 text-sm text-danger">{error.message}</p>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {runs.map(({ run, image, captions }) => (
                    <RunCard key={run.id} run={run} imageUrl={image?.image_url} captions={captions} showChain />
                ))}
            </div>
            {!runs.length && <p className="card p-8 text-center text-sm text-muted">No runs yet.</p>}
        </div>
    );
}
