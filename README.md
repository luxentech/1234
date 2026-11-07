# Public Partner Portal

تمام حلو اوي كده تمام هيا دلوقتي لما اضيف الفرص وكده والشركاء وكده تمام كل ده لما اضيفه من الملف الشخصي بتاع المدير البينات بتكون عندي في المتصفح انا بس بس لاء انا عايز اي حاجه اضيفها تكون في الموقع دايما وتظهر لاي حد يفتح الموقع من اي جهاز تمام فاهمني يعني زي المواقع التانيه فاهمني تمام وانا هرفعه علي استضافه فيرسل

# منصة Elevate — Elevate Platform

منصة متكاملة للفرص، المسابقات، المنح، والكورسات مع سيرفر Node.js وقاعدة بيانات SQL حقيقية (SQLite WAL).

## 🚀 تشغيل الموقع المباشر (Standalone Server)
يمكنك تشغيل الموقع فوراً وبدون الحاجة لأي أدوات بناء أو تعقيد عبر الأمر:

```bash
node elevate-server.js
```
أو:
```bash
npm start
```

- **رابط الموقع:** `http://localhost:3000`
- **صفحة تسجيل الدخول المخصصة:** `http://localhost:3000/login.html`
- **قاعدة البيانات:** `data/elevate.db` (SQLite مدمجة ومجهزة بكافة الجداول)

---

## 📁 هيكل الملفات الرئيسي

| الملف / المجلد | الوصف |
| :--- | :--- |
| `elevate-server.js` | ملف السيرفر الرئيسي المتكامل (يقدم صفحات الويب ويعالج كافة طلبات API وقاعدة البيانات) |
| `data/elevate.db` | ملف قاعدة البيانات الحقيقية SQLite (تخزين المستخدمين، البطاقات، والبيانات) |
| `public/site/index.html` | الصفحة الرئيسية للمنصة بجميع أقسامها وتفاعلاتها |
| `public/site/login.html` | صفحة تسجيل الدخول المستقلة (دخول، حساب جديد، ودخول بواسطة Google) |
| `public/site/style.css` | ملف التنسيقات والتصميم الكامل |
| `public/site/script.js` | ملف الجافاسكريبت البرمجي التفاعلي |
| `public/site/db-sync.js` | ملف المزامنة الحية الفورية بين المتصفح والسيرفر |

---

## 💻 التشغيل بنمط التطوير مع Vite / TanStack
```bash
npm install
npm run dev
```

---

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dc50970d-ed66-4f78-a9a0-d26aa2bb4e86).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
