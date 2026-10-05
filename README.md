# Salomatlik yo'lboshchisi (Telegram Mini App)

Fayllar: server.js, index.html, package.json, doctors.json (hammasi bitta papkada, ildizda).

## 1. GitHub
github.com da yangi repo oching, "Add file > Upload files" orqali 5 ta faylni yuklang.
.env faylini va API kalitni HECH QACHON GitHub'ga yuklamang.

## 2. Render
New > Web Service > repo'ni tanlang.
- Build Command: npm install
- Start Command: npm start
- Environment: BOT_TOKEN (BotFather'dan), ANTHROPIC_API_KEY (console.anthropic.com)
- ixtiyoriy: MODEL (standart: claude-sonnet-5-5)

## 3. Telegram
@BotFather > /newbot (yoki mavjud bot) > /newapp yoki Bot Settings > Menu Button >
URL: Render bergan https://....onrender.com manzili.

## Eslatma
- doctors.json dagi shifokorlar NAMUNA. Haqiqiy ma'lumot bilan almashtiring.
- Render bepul rejasida server uxlab qoladi, birinchi ochilish 30-60 soniya olishi mumkin.
- Suhbat serverda saqlanmaydi. Profil faqat foydalanuvchi telefonida (localStorage).
