import { createFileRoute } from "@tanstack/react-router";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      "x-xss-protection": "1; mode=block",
    },
  });

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `أنت "Elevate AI"، المساعد الذكي لمنصة Elevate التي تجمع الفرص للطلاب:
منح دراسية، مسابقات، وظائف، تطوع، كورسات مجانية، ورش عمل، فرص سفر ممولة، وقبول جامعي.
أجب دائماً بنفس لغة المستخدم (عربي أو إنجليزي)، بأسلوب ودود ومختصر وعملي،
وساعد المستخدم في اختيار الفرص المناسبة وطريقة التقديم وكتابة السيرة الذاتية وخطاب الدافع.`;

export const Route = createFileRoute("/api/public/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);
        const rate = checkRateLimit(ip, {
          windowMs: 60 * 1000,
          maxRequests: 20,
          keyPrefix: "chat",
        });
        if (!rate.allowed) {
          return json(
            { error: "تم تجاوز عدد الرسائل المسموح به مؤقتاً، يرجى الانتظار دقيقة." },
            429,
          );
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "AI not configured" }, 500);

        let body: { messages?: ChatMessage[]; context?: string };
        try {
          body = (await request.json()) as { messages?: ChatMessage[]; context?: string };
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const messages = (body.messages ?? [])
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim().length > 0,
          )
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

        if (messages.length === 0) return json({ error: "messages required" }, 400);

        const siteContext =
          typeof body.context === "string" && body.context.trim().length > 0
            ? `\n\nبيانات الفرص المنشورة حالياً على الموقع (استخدمها للإجابة عن أي سؤال عن فرص الموقع، ولا تخترع فرصاً غير موجودة):\n${body.context.slice(0, 8000)}`
            : "";

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "system", content: SYSTEM_PROMPT + siteContext }, ...messages],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error(`AI gateway error [${res.status}]: ${text}`);
          if (res.status === 429) return json({ error: "rate_limited" }, 429);
          if (res.status === 402) return json({ error: "payment_required" }, 402);
          return json({ error: "ai_error" }, 500);
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
        return json({ reply });
      },
    },
  },
});
