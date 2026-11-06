import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  target: z.enum(["en"]),
  texts: z.array(z.string().trim().min(1).max(1200)).min(1).max(40),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const Route = createFileRoute("/api/public/translate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Translation is not configured" }, 500);

        let parsed: z.infer<typeof requestSchema>;
        try {
          parsed = requestSchema.parse(await request.json());
        } catch {
          return json({ error: "Invalid translation request" }, 400);
        }

        const numbered = parsed.texts.map((text, index) => `${index + 1}. ${text}`).join("\n");
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            temperature: 0,
            messages: [
              {
                role: "system",
                content:
                  "Translate Arabic website interface and opportunity content into natural concise English. Preserve numbers, URLs, brand names, emojis, and placeholders. Return only a JSON array of translated strings in the same order, with no markdown.",
              },
              { role: "user", content: numbered },
            ],
          }),
        });

        if (!response.ok)
          return json({ error: "Translation failed" }, response.status === 429 ? 429 : 502);

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = payload.choices?.[0]?.message?.content?.trim() ?? "";
        try {
          const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
          const translations = z
            .array(z.string())
            .length(parsed.texts.length)
            .parse(JSON.parse(cleaned));
          return json({ translations });
        } catch {
          return json({ error: "Invalid translation response" }, 502);
        }
      },
    },
  },
});
