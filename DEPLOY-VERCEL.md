# رفع الموقع على Vercel

1. ارفع الكود على GitHub ثم اعمل Import للمشروع في Vercel.
2. Framework Preset: Other (الإعدادات موجودة في `vercel.json`).
3. أضف Environment Variables دي في Vercel (Production + Preview):

| Name                            | القيمة                            |
| ------------------------------- | --------------------------------- |
| `NITRO_PRESET`                  | `vercel`                          |
| `SUPABASE_URL`                  | نفس القيمة الموجودة في ملف `.env` |
| `SUPABASE_PUBLISHABLE_KEY`      | نفس القيمة الموجودة في `.env`     |
| `VITE_SUPABASE_URL`             | نفس `SUPABASE_URL`                |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | نفس `SUPABASE_PUBLISHABLE_KEY`    |
| `VITE_SUPABASE_PROJECT_ID`      | نفس `SUPABASE_PROJECT_ID`         |

> مفتاح الـ service role مش مطلوب. الحفظ والقراءة بيشتغلوا بمفتاح النشر (publishable)
> لأن سياسات قاعدة البيانات معمولة كده.

4. اضغط Deploy.

## إيه اللي بيحصل بعد الرفع

- أي إضافة من لوحة الإدارة (شريك / فرصة / إشعار) بتتبعت لـ `/api/public/store`
  وتتخزن في جدول `site_store` في قاعدة البيانات.
- أي زائر أو جهاز تاني بيقرأ نفس البيانات من قاعدة البيانات أول ما يفتح الموقع،
  وبيتحدّث تلقائيًا كل 15 ثانية وكل ما يرجع للتاب.
- بيانات الدخول الافتراضية للأدمن: `admin@elevate.com` / `Elevate@Admin#2026`
  (غيّر الباسورد من الكود في `public/site/script.js` قبل الرفع النهائي).
