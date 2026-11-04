import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Second layer of defense (the proxy is the first, RLS is the last):
// every admin page and server action calls this.
export async function requireAdmin() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    if (!profile?.is_superadmin) redirect("/login?error=not_admin");

    return { supabase, user, profile };
}
