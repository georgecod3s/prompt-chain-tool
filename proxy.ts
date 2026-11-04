import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Every route goes through here. Only /login and /auth/* are public.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/signout"];

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options),
                    );
                },
            },
        },
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
        return response;
    }

    const redirect = (reason?: string) => {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = reason ? `?error=${reason}` : "";
        return NextResponse.redirect(url);
    };

    if (!user) {
        return redirect();
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .maybeSingle();

    if (!profile?.is_superadmin) {
        return redirect("not_admin");
    }

    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
