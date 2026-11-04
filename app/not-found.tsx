import Link from "next/link";

export default function NotFound() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-3">
            <h1 className="text-2xl font-bold">Not found</h1>
            <Link href="/" className="text-accent hover:underline">Back to prompt chains</Link>
        </main>
    );
}
