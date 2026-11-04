// Public, browser-safe Supabase settings (the publishable key is designed to be
// shipped to clients; Row Level Security is what protects the data).
// Env vars override these if set in Vercel.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://neoxgfkngwxwmixwsfgc.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_IT21_p9m7N0hxWrqAMigpQ_10EcqevU";
