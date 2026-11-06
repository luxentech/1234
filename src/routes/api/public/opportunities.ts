import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const Route = createFileRoute("/api/public/opportunities")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const category = url.searchParams.get("category");
        const search = url.searchParams.get("q");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        let query = supabase
          .from("opportunities")
          .select(
            "id,title,title_ar,description,description_ar,category,organization,location,deadline,apply_url,image_url,status,featured,created_at",
          )
          .neq("status", "hidden")
          .order("featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limit);

        if (category) query = query.eq("category", category);
        if (search) query = query.ilike("title", `%${search}%`);

        const { data, error } = await query;
        if (error) return json({ error: error.message }, 500);
        return json({ data });
      },
    },
  },
});
