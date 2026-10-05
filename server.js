const express = require("express");
const crypto = require("crypto");
const path = require("path");
const doctors = require("./doctors.json");

const { BOT_TOKEN, ANTHROPIC_API_KEY, MODEL = "claude-sonnet-5-5", DEV_MODE, PORT = 3000 } = process.env;

const SPECIALISTS = ["urolog", "ginekolog", "venerolog", "terapevt", "kardiolog", "nevrolog", "gastroenterolog", "dermatolog", "endokrinolog", "lor", "oftalmolog", "ortoped", "pediatr", "psixiatr", "stomatolog"];

const SYSTEM = `You are "Salomatlik yo'lboshchisi", a medical guidance assistant inside a Telegram Mini App in Uzbekistan.

Language: reply in the user's language (Uzbek, Latin script, by default; Russian if the user writes Russian).

Role: you do NOT diagnose. You help the user understand likely causes, decide which specialist to see and how urgent it is, and prepare for the visit.

Style: calm, clinical, non-judgmental, like an experienced doctor. Use correct anatomical and medical terms openly, including for sexual and reproductive health (urology, gynecology, STIs, erectile dysfunction, contraception, fertility, sex education). No shame, no moralizing. Never write erotic or pornographic content.

Minors (age under 18): age-appropriate sexual health education only (puberty, hygiene, consent, protection, abuse prevention), no explicit sexual detail. If abuse is mentioned, calmly urge telling a trusted adult and getting help.

Process: ask at most 1-2 short follow-up questions at a time (duration, severity, fever, bleeding, medicines, chronic illness). When you have enough, give: likely causes (most to least likely), which specialist, what tests may be useful, what to ask the doctor.

Red flags (chest pain, trouble breathing, heavy bleeding, stroke signs, sudden severe testicular or abdominal pain, pregnancy complications, thoughts of self-harm, etc.): urgency "red", tell the user to call 103 or go to emergency care now. For self-harm thoughts be warm and supportive.

Evidence: rely on established clinical guidelines and research; be honest about uncertainty. NEVER invent studies, links, doctor names, prices or pharmacy availability (the app supplies doctors from its own database). Do not give personal dosing for prescription drugs.

Output: respond with ONLY a JSON object, no markdown fences:
{"reply": "plain text, max 160 words, no markdown", "urgency": "green" | "yellow" | "red" | null, "specialist": one of ${JSON.stringify(SPECIALISTS)} or null}
Keep urgency and specialist null while you are still asking questions.`;

const app = express();
app.use(express.json({ limit: "30kb" }));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

// Telegram initData imzosini tekshirish
function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calc = crypto.createHmac("sha256", secret).update(check).digest("hex");
  const a = Buffer.from(calc), b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() / 1000 - Number(params.get("auth_date")) > 86400) return null;
  try { return String(JSON.parse(params.get("user")).id); } catch { return null; }
}

function auth(req, res, next) {
  const id = verifyInitData(req.get("x-init-data"));
  if (id) { req.uid = id; return next(); }
  if (DEV_MODE === "1") { req.uid = "dev"; return next(); }
  res.status(401).json({ error: "Ilovani Telegram ichidan oching." });
}

const hits = new Map();
function limited(uid) {
  const now = Date.now();
  const arr = (hits.get(uid) || []).filter((t) => now - t < 3600e3);
  arr.push(now);
  hits.set(uid, arr);
  return arr.length > 30;
}

app.post("/api/chat", auth, async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "Server sozlanmagan (API kalit yo'q)." });
  if (limited(req.uid)) return res.status(429).json({ error: "Soatiga 30 ta xabar limiti. Keyinroq urinib ko'ring." });

  const { profile = {}, messages = [] } = req.body || {};
  const age = Math.min(120, Math.max(0, parseInt(profile.age, 10) || 0));
  const gender = ["erkak", "ayol"].includes(profile.gender) ? profile.gender : "noma'lum";
  const msgs = (Array.isArray(messages) ? messages : [])
    .slice(-12)
    .filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) return res.status(400).json({ error: "Xabar bo'sh." });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        system: `${SYSTEM}\n\nPatient: age ${age}, sex ${gender}.`,
        messages: msgs,
      }),
    });
    if (!r.ok) { console.error("Anthropic xato:", r.status); return res.status(502).json({ error: "AI hozir javob bera olmadi. Qayta urinib ko'ring." }); }
    const data = await r.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    let out;
    try { out = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim()); } catch { out = { reply: text }; }
    const spec = String(out.specialist || "").toLowerCase();
    res.json({
      reply: String(out.reply || "Kechirasiz, javobni tushunmadim. Qayta yozing."),
      urgency: ["green", "yellow", "red"].includes(out.urgency) ? out.urgency : null,
      specialist: SPECIALISTS.includes(spec) ? spec : null,
    });
  } catch (e) {
    console.error("Chat xato:", e.message);
    res.status(500).json({ error: "Server xatosi. Qayta urinib ko'ring." });
  }
});

app.get("/api/doctors", auth, (req, res) => {
  const s = String(req.query.specialty || "").toLowerCase();
  const list = doctors.filter((d) => !s || d.specialty === s).sort((a, b) => b.rating - a.rating).slice(0, 5);
  res.json(list);
});

app.listen(PORT, () => console.log("Server ishga tushdi:", PORT));
