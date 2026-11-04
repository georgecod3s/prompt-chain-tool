import { createClient } from "@/utils/supabase/server";
import LoginButton from "./LoginButton";
import ThemeToggle from "../ThemeToggle";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const { error } = await searchParams;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const denied = error === "not_admin" && user;

    return (
        <main className="relative flex min-h-screen items-center justify-center px-4">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-sm card p-8 shadow-sm text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-xl font-black text-accent-fg">
                    ⛓
                </div>
                <h1 className="text-2xl font-bold">Prompt Chain Tool</h1>
                <p className="mt-2 text-sm text-muted">Caption Clash · superadmins only.</p>

                {denied ? (
                    <div className="mt-6 rounded-xl border border-danger/40 bg-danger-soft p-4 text-left text-sm text-danger">
                        <p className="font-semibold">Access denied</p>
                        <p className="mt-1">
                            {user.email} is signed in but is not a superadmin
                            (<code>profiles.is_superadmin</code> is false).
                        </p>
                        <form action="/auth/signout" method="post" className="mt-3">
                            <button className="rounded-lg border border-danger/40 px-3 py-1.5 font-medium hover:bg-danger-soft">
                                Sign out and try another account
                            </button>
                        </form>
                    </div>
                ) : (
                    <LoginButton />
                )}
            </div>
        </main>
    );
}
