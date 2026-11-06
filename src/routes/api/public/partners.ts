import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/partners")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data, error } = await supabase
          .from("partners")
          .select("id,name,logo_url,website_url")
          .order("created_at", { ascending: true });

        return new Response(JSON.stringify(error ? { error: error.message } : { data }), {
          status: error ? 500 : 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      },
    },
  },
});
