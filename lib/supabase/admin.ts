import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) as string;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export async function getAdminSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components may not set cookies.
        }
      }
    }
  });
}
