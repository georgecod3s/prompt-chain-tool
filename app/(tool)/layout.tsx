import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import ThemeToggle from "../ThemeToggle";

export default async function ToolLayout({ children }: LayoutProps<"/">) {
    const { user, profile } = await requireAdmin();
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-black text-accent-fg">⛓</span>
                        <span className="leading-tight">
                            <span className="block text-sm font-bold">Prompt Chain Tool</span>
                            <span className="block text-xs text-muted">Caption Clash</span>
                        </span>
                    </Link>
                    <nav className="ml-2 flex gap-1 text-sm">
                        <Link href="/" className="rounded-lg px-3 py-1.5 font-medium text-muted hover:bg-surface-2 hover:text-fg">Chains</Link>
                        <Link href="/runs" className="rounded-lg px-3 py-1.5 font-medium text-muted hover:bg-surface-2 hover:text-fg">All runs</Link>
                    </nav>
                    <div className="ml-auto flex items-center gap-3">
                        <ThemeToggle />
                        <div className="hidden text-right sm:block">
                            <p className="max-w-[12rem] truncate text-xs font-medium">{name}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">superadmin</p>
                        </div>
                        <form action="/auth/signout" method="post">
                            <button className="btn btn-ghost btn-icon text-xs">Sign out</button>
                        </form>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">{children}</main>
        </div>
    );
}
