# Sombra: build plan (Sierra Hacks 2026)

> **Sombra** (Spanish for "shade") is an AI command center that keeps Central Valley farm crews safe in heat and wildfire smoke.
> A crew lead says what tomorrow looks like. A team of AI agents builds a shift plan around the live forecast and California's heat law, sends it to every worker's phone in Spanish or Punjabi, and listens when a worker says "me siento mareado" ("I feel dizzy").

**Prompt:** solve a real challenge in Central Valley agriculture, transportation, education or community life. Show who it helps.
**Who it helps:** a crew lead (*mayordomo*) for a farm labor contractor near Manteca, and the 30 to 40 workers on their crew.

---

## 0. Who does what (read this first)

**Deadline: Devpost submitted by 6:15pm** (the real deadline is 6:30; the extra 15 minutes are buffer).

| | **Atharv** | **Darshan** |
|---|---|---|
| Tools | Claude Code (Opus for hard parts, Sonnet for polish) plus a cloud Claude Code session for the phone page | **No Claude Code.** gemini.google.com, Google Colab (its built-in Gemini helps with errors), Google Slides, and the GitHub website for uploads |
| Owns | All app code: `app/**`, `lib/**`, deploys, merging | The AI model's data and training, facts and sources, slides, video, Devpost story |
| Step-by-step guide | Section 5A below | **[`ml/README.md`](ml/README.md)**, plus section 5B below |

Darshan never edits app code, so we can't have merge conflicts. He uploads files to a `darshan` branch through the GitHub website, and Atharv merges them.

## Status board (keep this current)

**Live site:** https://sombra-pied.vercel.app · **Worker phone:** https://sombra-pied.vercel.app/crew/latest · every push to `main` deploys automatically.

### Keys and accounts
| Variable | Where | What it does | Notes |
|---|---|---|---|
| `LLM_PROVIDER=openrouter` | `.env.local` + Vercel | Picks the AI provider | |
| `OPENROUTER_API_KEYS=key1,key2,key3` | `.env.local` + Vercel | The 5 agents, translation, Medic | One key per free account (~50 requests/day each). The app moves to the next key automatically when one hits its limit. $10 of credit on one account = ~1,000/day |
| `GROQ_API_KEY` | `.env.local` + Vercel | Whisper voice-to-text, any language | **Without it in Vercel the phone mic doesn't work in Brave**, and is unreliable on iPhone |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel (auto) | Shared storage so laptop and phones see the same plan | Copy them into `.env.local` too if you want phones to work with your laptop's localhost |
| `NEXT_PUBLIC_SITE_URL` | `.env.local` | QR codes made on localhost point at the live site | |

After changing a Vercel variable: **Deployments → ⋯ → Redeploy**.

### Features
✅ done · ⬜ to do · ⭐ stretch

**Crew boss, laptop (`/command`)**
- ✅ Plain-English intro of the problem (114°F, July 11, 2024)
- ✅ Map of 3 real fields, colored by heat at the chosen hour, crew names + temperature on each, with an explanation
- ✅ Heat-danger strip per field by hour, with a slider and an explanation; Heat wave / Live toggle loads that day's weather
- ✅ Crew editor (wraps on phones)
- ✅ 5 AI agents stream live (Cielo, Ley, Crítico, Cuadrilla, Voz), each showing its model; Crítico rejects the usual day
- ✅ Rules engine: Cal/OSHA checks, paid cool-downs, water, shade; **no crew works in deadly heat**; a plan that breaks a rule can't ship
- ✅ Impact scorecard: deadly-heat worker-hours, violations, hottest temperature worked, hours kept, paid break wages, one line per crew
- ✅ Usual day vs Sombra timelines drawn over the heat colors, am/pm times, legend
- ✅ **Play the day:** 4am→7pm in about 25 seconds, live counters, story ticker, a real heat alert to phones at the first deadly hour
- ✅ Separate channel per crew: worker messages in any language → English, our model's label, Medic first aid; replies translated; unread badges
- ✅ Heat alert to one crew or all crews; red banner + alarm on the laptop when a worker reports heat illness
- ✅ Active plan restored on load; QR code + `/crew/latest`
- ✅ Survives a dead AI: timeouts, key rotation, rules fallback, `?demo=1` replay
- ⬜ Record `public/demo/run.json` from a good real run
- ⬜ Design pass (Sonnet + taste skill)
- ⭐ Wildfire-smoke replay day · ⭐ downloadable Cal/OSHA compliance log

**Worker, phone (`/crew/[id]` or `/crew/latest`)**
- ✅ Español / ਪੰਜਾਬੀ / English; pick your crew
- ✅ Your day in large type, am/pm, current block highlighted, "+$3.67" on paid breaks
- ✅ Briefing read aloud (server audio for Punjabi)
- ✅ Push-to-talk in any language (Whisper), with a seconds counter and auto-send at 20s; a typing box as backup
- ✅ Smart routing: health → advice + boss alert; requests and questions → forwarded; unclear → forwarded with "(unclear)"
- ✅ One timestamped thread with the crew boss; new boss messages read aloud
- ✅ Full-screen heat-alert takeover with alarm and vibration
- ✅ Follows the newest plan automatically; expired plan → "waiting for your crew boss"
- ⬜ Tested on a real iPhone + Android (and in Safari/Chrome, not just Brave)

**Our AI model (Darshan)**
- ⬜ `train.csv` + **hand-written** `test.csv` → `triage.json` + `confusion.png` on the `darshan` branch (until then the app shows "fallback (keywords)")
- ✅ The app already runs `triage.json` and the `/about` model card fills itself in
- ⬜ `docs/facts.md` with sources

**Ship**
- ⬜ Repo public + README · ⬜ 2-minute video (film Play the day with a phone going off) · ⬜ 5 slides · ⬜ Devpost on main + AI/ML tracks by 6:15

### Final demo script (3 minutes + 2 minutes of questions)
Screens: `docs/screenshots/01-command.png` … `08-phone-heat-alert.png`.

**Before going on stage (2 min):**
1. Laptop on https://sombra-pied.vercel.app (Chrome, full screen). If a plan is active and the agents show real text, keep it. Otherwise press End day, pick **Jul 11, 2024**, press **Plan a safe day** and wait about 30 s.
2. Phone A (yours) on `/crew/latest`: tap **turn on alerts**, pick **Español**, **Crew 1**. Phone B (for a judge): same, **ਪੰਜਾਬੀ**, **Crew 2**. Volume up.
3. Click anywhere on the laptop page once so its sounds are allowed.

| Time | Say | Show |
|---|---|---|
| 0:00 to 0:20 | "July 11, 2024: 114 degrees outside Manteca. Farmworkers die of heat at about 20 times the rate of other workers, and piece-rate pay means a water break costs them money. Rosa runs three crews here." | The big **115°** and the red **deadly heat for 6 hours** line, then the satellite map |
| 0:20 to 0:55 | "Five AI models plan her day. Cielo reads the heat, Ley checks California heat law, Crítico tries to break the plan and rejects her usual schedule, Cuadrilla rebuilds it, Voz writes briefings. Plain code has the final say on the law." | **Expand the brain**: the flow map with real numbers on each arrow. Close it |
| 0:55 to 1:20 | "The result: 168 worker-hours of deadly heat become zero, 8 law violations become zero, and workers get $324 in paid breaks they didn't get before, while keeping 88% of the hours." | The ring and scorecard, then **Your usual day** (red boxes, rule table) and **Sombra's plan** (What changes table) |
| 1:20 to 2:05 | "Every worker gets their crew's plan on their phone, in their language, out loud." | Hand Phone B to a judge. They press **Listen**, then tap **ਮੈਨੂੰ ਠੀਕ ਨਹੀਂ ਲੱਗ ਰਿਹਾ** (I feel sick) or speak. The laptop chimes or alarms, Crew 2's channel shows it in English, Medic adds first aid. Type a reply; it arrives in Punjabi, read aloud |
| 2:05 to 2:40 | "And it watches the whole day." | **▶ Play the day**: the clock runs, the counters split, the story ticker. At the first deadly hour both phones go full-screen red with an alarm |
| 2:40 to 3:00 | "Our own model, trained and tested on sentences we wrote by hand, flags emergencies. AI drafts, code enforces the law, nothing is kept past 48 hours." | The `/about` model card for 3 s, the **Compliance log** download, the **Privacy** link |

**If something fails on stage:** AI slow → the agents fall back to the rules engine in seconds and the plan still works (say "AI busy, so the rules engine answered" is the safety net). Wi-Fi down → `?demo=1` replays a recorded run. Phone sound blocked → show the red takeover screen.

### Facts to memorize (say these, not features)
- **114°F** in Manteca on **July 11, 2024** (real archived weather); deadly heat from **noon to 6pm**.
- Farmworkers die of heat at about **20×** the rate of other US workers (CDC MMWR; see docs/facts.md).
- On that day Sombra cut **168 worker-hours of deadly heat to 0**, fixed **8 Cal/OSHA violations**, kept **88%** of work hours and paid **$324** in cool-down wages workers didn't get before.
- **5 AI agents + 1 rules engine**: the AI drafts, plain code enforces the law, and the AI can only raise a health alert, never lower one.
- **Our own model** (sombra-triage v1): **430** training sentences, **40** written by hand for testing, **80%** accuracy, **80%** emergency recall, in English, Spanish and Punjabi. We tried a v2, saw emergency recall drop to 70%, and kept v1.
- Workers can speak or tap in **any language** (tested: Vietnamese translated correctly); the boss reads English.
- **Paid breaks are the hook**: piece-rate workers skip breaks because they lose money; Sombra shows "+$3.67" on every paid cool-down (CA Labor Code 226.2).
- **Privacy**: random worker codes, no names, no audio kept, everything deleted after **48 hours**.

### Features list (Devpost and questions)
**Crew boss, laptop**
- 5 real days to plan: 114°F heat wave, 118°F record heat, a 104°F day, a wildfire smoke drill, and today's live forecast. The day locks once planned; End day unlocks it and clears every phone
- Satellite map of 3 real fields colored by hourly heat danger, with crews and temperatures, and an hour slider
- 5 AI agents (Cielo, Ley, Crítico, Cuadrilla, Voz) streaming live, plus Medic for check-ins; "Inside Sombra's AI" panel with every agent's reasoning, model and verdict, and an expandable flow map with the real data passed between them
- Deterministic rules engine for Cal/OSHA §3395 (shade, water, cool-downs, new-worker acclimatization) and §5141.1 (wildfire smoke, N95s). No crew works in deadly heat. A plan that breaks a rule cannot ship
- Before/after scorecard and ring chart: deadly-heat worker-hours, violations, hottest temperature worked, hours kept, paid break wages
- Usual day vs Sombra timelines; rule-by-crew table; "What changes" table per crew; Sombra's plan morphs in from the usual day
- Play the day: 4am to 7pm in 25 seconds, live counters, story ticker, sun-tinted background, real heat alert to phones
- Separate channel per crew: messages in any language translated to English, our model's health label, Medic's second opinion and first aid, "no reply yet" flags, unread badges; replies translated to Spanish or Punjabi
- Heat alert (one crew or all), Ask how they feel, alarms and chimes, a red banner for emergencies
- Compliance log CSV, QR code and `/crew/latest`, privacy and data-safety page, model card, credits

**Worker, phone**
- Español, ਪੰਜਾਬੀ, English; pick your crew; the whole screen and every message switch language instantly
- Now / Next card ("Paid break +$3.67 in 10 min"), schedule in large type, per-crew spoken briefing (server voice for Punjabi)
- One-tap I'm OK / I need water / I feel sick, push-to-talk in any language (Whisper) with a voice-level ring and auto-send, typing as a backup
- Instant, specific replies; health messages alert the boss; chit-chat just shows delivered
- Full-screen heat alert with alarm and vibration; follows the newest plan; "waiting for your crew boss" when no plan is active

**AI and ML**
- Our model: sombra-triage v1, character n-gram TF-IDF + logistic regression, 430 training sentences, 40 hand-written test sentences in 3 languages, 80% accuracy, 80% emergency recall; v2 with 150 extra sentences was tested and rejected (emergency recall fell to 70%)
- Safety: emergency keywords always escalate; Medic can raise severity but never lower it; the rules engine decides compliance
- Resilience: several API keys rotate, Groq backs up OpenRouter, 15-second timeouts, rules-engine fallback, recorded demo replay

**Likely questions:** what if the AI is wrong · where does worker data go · workers without smartphones (next: SMS and Mixteco) · how is this different from the OSHA heat app (that's one person's number; this plans the whole crew, checks the law, and talks both ways) · cost (free-tier AI, rules fallback)

---|---|---|
| 0:00–0:20 | "Farmworkers die of heat at about 20× the rate of other workers. Piece-rate pay means a break costs them money. Rosa runs 3 crews outside Manteca." | Point at the big date and temperature |
| 0:20–1:00 | "Five AI agents read the forecast and California heat law. Crítico rejects her usual day; the plan is rebuilt." | Scroll: scorecard (deadly heat → 0, paid breaks), rule grid ✗ → What changes table |
| 1:00–1:50 | "Every worker gets it on their phone, in their language, out loud." | Hand a judge the phone: Español, Listen, then tap **I feel sick** or say "me siento mareado". The laptop banner and alarm go off; Medic + our model label appear |
| 1:50–2:30 | "And it runs the whole day." | **▶ Play the day**: counters tick, the cool-down check-in arrives, then at 1pm both phones go full-screen red |
| 2:30–3:00 | "Our own model, trained and tested on sentences we wrote by hand. AI drafts, plain code enforces the law, and nothing is stored past 2 days." | Flash `/about` (model card), Compliance log download |

**Questions to expect:** what if the AI is wrong (rules engine decides, Medic can only raise severity, safety keywords) · privacy (worker IDs only, no audio stored, 2-day expiry) · no smartphone (one-tap buttons, read-aloud, next step is SMS) · cost (free-tier AI plus rules fallback).

---

## 1. Why this idea wins (from past winners)

| Pattern in winners | Who did it | How Sombra uses it |
|---|---|---|
| Specialist agents working in parallel on a live dashboard | EDFlow (Cal Hacks 12), Orion, ContainOS (TreeHacks 26) | 5 agents on a map of real fields. Their cards light up live |
| Real-time, real data | Hawkwatch, Project No Cap | Live Open-Meteo forecast and air quality, plus a replay of a real past heat wave |
| Accessibility and language as the human story | Accent (LA Hacks 26), VibeGuard (Sierra 25) | Workers get spoken briefings in their own language and can answer back by voice |
| Visible AI reasoning, with the technique named | MentoLab (Sierra 25 1st + Best AI) | Agent Panel, a Critic that rejects bad plans, and a model card for our own classifier |
| A demo that never breaks | EyeCraft (HackMIT 25) | `?demo=1` replays cached responses if the wifi dies |
| Hand the judge something | Mira, Shepherd | The judge scans a QR code, their phone becomes a worker's phone, and they talk to it |

**What we avoid:** crop-disease photo classifiers. They're the most common agriculture hackathon project on Devpost, so judges have seen dozens and Innovation (30%) would suffer. Single-person heat-index apps already exist (OSHA-NIOSH Heat Safety Tool, HeatShe).

**Our one-line answer to "how is this different from the OSHA heat app":** that app shows one person a number. Sombra plans the whole crew's day, checks it against California law, talks to every worker in their own language, and listens back.

---

## 2. The demo (2 minutes, rehearse this exact flow)

1. **(15s) Person.** "Rosa runs a 38-person crew picking tomatoes outside Manteca. On a 114° day she has to schedule shade, water, rest breaks and start times by law, for workers who speak three languages. Farmworkers die of heat at about 20 times the rate of other workers." *(Darshan verifies this figure in docs/facts.md.)*
2. **(40s) Command center.** Choose the **July 11, 2024 heat-wave replay** (114°F in Manteca, real archived weather). Rosa enters her 3 crews (6 new workers on Crew 2) and her usual 6am–2:30pm shift, then clicks **Plan a safe day**.
   - The map fills with fields. A timeline from 5am to 7pm turns red in the afternoon.
   - Five agent cards stream live.
   - **The Critic rejects the first plan:** "Crew 2 has 6 workers on their 2nd day (acclimatization) picking at 1pm at 101°F. That violates §3395(g)." The Planner revises it live.
   - The final plan: start 4:30am, move crew 2 to the shaded orchard, 10-minute cool-down every 2 hours, 95 gallons of water, done by 12:30.
3. **(30s) Hand the judge the phone.** They scan the QR code. Their phone shows the plan in Spanish (or Punjabi) and reads it aloud.
4. **(20s) The judge talks back.** They tap the mic and say *"me duele la cabeza y estoy mareado"* ("I have a headache and feel dizzy"). On the laptop, that worker's dot turns red. The on-device classifier says "heat exhaustion, 0.91" and the Medic agent agrees. A first-aid checklist pops up for Rosa.
5. **(15s) How it works and safety.** Name the agents, the deterministic rules engine and the classifier. One line on privacy: "Workers' words are classified on our server and are never stored."

---

## 3. Architecture

```
Crew lead (laptop)                                     Worker (phone)
/command ──POST──> /api/plan (SSE) ──> agent swarm     /crew/[planId]
   ▲                  │                                   │  ▲
   │                  ├─ lib/weather.ts  (Open-Meteo, no key)
   │                  ├─ lib/heat.ts     (WBGT + risk bands)
   │                  ├─ lib/rules.ts    (Cal/OSHA §3395 + §5141.1, deterministic)
   │                  └─ lib/llm.ts      (Claude / Gemini switch)
   │                                                      │
   └──── poll /api/alerts <── /api/checkin <── voice ─────┘
                                 ├─ lib/triage (our trained classifier)
                                 └─ Medic agent (LLM second opinion)
store: Upstash Redis (Vercel Marketplace, free) · fallback: plan encoded in the QR URL
```

**Agents** (each is a config object: name, role, prompt, color):

| Agent | Job | Uses |
|---|---|---|
| **Cielo** (sky scout) | Hourly temp, humidity, sun, wind and PM2.5 per field, turned into WBGT bands | `weather.ts`, `heat.ts` |
| **Ley** (the law) | Checks the plan against the rules engine and cites subsections | `rules.ts` output, no free-form legal claims |
| **Cuadrilla** (the crew) | Start times, field order, breaks, water (1 qt per worker per hour), shade trailers | Cielo's output + crew input |
| **Voz** (the voice) | Spanish and Punjabi briefings at a 5th-grade reading level, sent to TTS | LLM |
| **Crítico** (the critic) | Red-teams the plan and can reject it once, which triggers a revision | All of the above |
| **Medic** (on check-in) | Second opinion on a worker's symptoms, plus a first-aid checklist | Triage result |

**The key design choice (it's also the answer to "what if the AI is wrong?"):** the LLM drafts, but `rules.ts` is plain code that verifies. A plan that breaks a rule can't be sent.

**Today is a mild October day**, so live weather won't look dangerous. Build two modes: **Live** (today) and **Replay** (a real July 2024 heat-wave day pulled from the Open-Meteo historical archive). The replay data is real, just from a past date, so say that out loud in the demo.

**Rules to encode** (Darshan checks each against dir.ca.gov in docs/facts.md):
- 80°F and above: shade up and water available (§3395(c)–(d)). Water is 1 quart per worker per hour.
- 95°F and above: high-heat procedures, a pre-shift meeting, and for agriculture a 10-minute cool-down rest every 2 hours (§3395(e)).
- New workers (first 14 days) and heat waves: close observation (§3395(g)).
- Wildfire smoke, AQI for PM2.5 of 151 or higher: respirators provided; above 500, required (§5141.1).

---

## 4. AI/ML track: what makes us more than an API wrapper

**The track's 5 rules, and how we meet each one:**

| Rule | How Sombra meets it |
|---|---|
| AI/ML is a core feature, not an add-on | Without the AI there's no product: the agents make the plan and the classifier makes the triage call. Say this in the pitch: "Turn off the AI and Sombra can't do anything." |
| Name the model, API or dataset | Every agent card shows a model badge (`claude-sonnet-5-5`, `sombra-triage v1 (ours)`). A footer and the `/about/model` page list everything in the credits list below |
| Show the AI working live in the demo | The Critic's rejection and the check-in triage happen live in front of the judges. If wifi forces `?demo=1`, **say out loud that it's a replay** |
| Explain in 1 sentence what it learns or decides | **"Sombra's agents decide when and where each crew works from the hourly heat forecast and California's heat law, and our own classifier learns to spot heat illness from a worker's words in Spanish, Punjabi or English."** Put this on the landing page, the model card, the Devpost tagline area and the pitch |
| Credit tools, data and code we didn't write | A `/credits` page, a README section and a Devpost "Built with" section (list below). **Be upfront that Claude Code helped write the code** |

**Credits list (keep it current all day):**
- **AI models:** Anthropic Claude Sonnet 5.5 (agents); Google Gemini (fallback and voice transcription).
- **Data and APIs:**
  - Open-Meteo forecast, historical archive and air-quality APIs. Their license (CC BY 4.0) requires attribution on screen.
  - The Cal/OSHA §3395 and §5141.1 rule text.
  - CDC/NIOSH heat-illness symptom lists.
- **Our dataset:** sentences generated with Claude from those symptom lists and hand-checked, plus a test set written by us.
- **Libraries:** Next.js, Tailwind, scikit-learn, MapLibre and OpenStreetMap map tiles (attribution required), Upstash.
- **Tools:** Claude Code, plus the design skills frontend-design (Anthropic), taste-skill (Leonxlnx) and transitions.dev (Jakub Antalik).

Beyond those rules, AI/ML judges usually reward a model the team trained and evaluated itself. So we have three layers, and every one shows up in the UI:

1. **Our own trained model: a multilingual heat-illness triage classifier** (Darshan, see [`ml/README.md`](ml/README.md)).
   - **Labels:** `ok`, `warning` (cramps, heavy sweating, thirst), `heat_exhaustion` (dizzy, headache, nausea, weak), `emergency` (confused, fainted, stopped sweating, hot dry skin, slurred speech). Symptom lists come from CDC/NIOSH.
   - **Data:** about 400 sentences in Spanish, Punjabi, English and Spanglish. Generate them with Claude from the symptom lists and hand-check 50. **The test set is written by teammates, not generated**, so the evaluation is honest.
   - **Model v1 (guaranteed in about 1 hour, all in Colab):** character n-gram TF-IDF plus logistic regression in scikit-learn. Export the weights to `public/model/triage.json` and run inference in TypeScript (a dot product and softmax).
   - **Metric that matters:** recall on `emergency`. Lower the threshold until no emergency is missed, and show the confusion matrix on the model card.
   - **Safety floor:** emergency keywords always escalate, whatever the model says.
2. **Physics model:** WBGT from temperature, humidity, solar radiation and wind (Liljegren or a simplified approximation). It explains why a humid 92° can be worse than a dry 97°.
3. **Agent orchestration:** parallel agents, a Critic-and-revise loop, and retrieval-style grounding in the rule text.

**An `/about/model` page (the model card)** shows the dataset, the metrics table, the confusion matrix and known limits. AI/ML judges read this, and it doubles as Devpost material.

---

## 5A. Atharv: what to do and when

| Time | Do | Done when |
|---|---|---|
| Now | Get a working AI key: a new Gemini key in a **new** AI Studio project (the current one has $0 prepaid credit), or an Anthropic key with `LLM_PROVIDER=claude`. Invite Darshan: `gh repo edit atharv146/sombra --add-collaborator HIS_USERNAME` | The swarm on `/command` shows real agent text |
| 11:00–1:00 | Check in on the cloud session building `/crew` (branch `crew`). Tune the agent prompts against real output. Move `lib/store.ts` to Upstash Redis, because Vercel needs shared storage for the QR code link to work | Plan → QR → phone works on localhost |
| 1:00–1:30 | Merge `crew`, then deploy to Vercel with the env vars set. Lunch. Check `/usage` | A live URL that works on your phone |
| 1:30–3:00 | Merge Darshan's model (`triage.json` → `public/model/`). Build the check-in alert feed on `/command`, the Medic agent, the `/about/model` page (metrics + `confusion.png`) and `/credits` | A judge's spoken check-in turns a worker red on the laptop |
| 3:00–4:30 | **Switch to Sonnet.** Design pass with the taste skill and Playwright screenshots. Add `?demo=1`, which replays a recorded run if the wifi dies | **4:30 feature freeze** |
| 4:30–5:30 | Bugs only. Final deploy. **Make the repo public.** Run the full demo 3 times on the live URL | Nothing breaks 3 times in a row |
| 5:30–6:15 | Devpost "How we built it", "Built with" and the AI/ML section. Darshan submits | **6:15 submitted** |
| 6:15–6:30 | Rehearse the 2-minute pitch together | |

**Model use:** Opus only for the agent engine, merges and bugs Sonnet fails twice. Sonnet for design, copy and Playwright loops. The app's own AI calls are billed to the API key, not your Claude plan.

## 5B. Darshan: what to do and when (no Claude Code)

| Time | Do | Hand off |
|---|---|---|
| 11:00–11:45 | **[`ml/README.md`](ml/README.md) steps 1–2:** make `train.csv` with Gemini; write `test.csv` (40 sentences) **yourself** | |
| 11:45–12:15 | **Steps 3–4:** train in Colab with [`ml/train_colab.py`](ml/train_colab.py), upload 4 files to the `darshan` branch | Text Atharv the accuracy and emergency recall |
| 12:15–1:00 | **Step 5:** `docs/facts.md`. Check every number against a source | Upload to the `darshan` branch |
| 1:00–1:30 | Lunch. Open the live URL on your phone, scan the QR code, and try it | Text Atharv anything broken |
| 1:30–2:00 | Draft Devpost: Inspiration, What it does, Challenges, What's next. Use Gemini to help, but edit it so it sounds like us | Google Doc shared with Atharv |
| 2:00–2:30 | **Go to the 2pm ML workshop.** Write down the words organizers use for good ML and add them to the model card text | Notes |
| 2:30–3:30 | Model card text: dataset (how it was made, sizes), the model (TF-IDF character n-grams + logistic regression), metrics, mistakes it makes, limits. Also the credits list (PLAN.md section 4) | Google Doc |
| 3:30–4:30 | 5 slides in Google Slides: Rosa's problem, live demo (just a title), how it works (agents + our model), impact + facts, privacy and safety | Slides link |
| 4:30–5:30 | Test everything on your phone and log bugs. Then record the 2-minute demo video with Cmd+Shift+5, following section 2 | Video uploaded to YouTube as unlisted |
| 5:30–6:15 | Fill in Devpost, upload screenshots and the video, select **main track + AI/ML track**, and **submit by 6:15** | Submitted |

**Darshan's helpers:** Gemini for writing and for fixing Colab errors, Google for sources, and free Claude chat only for proofreading if Gemini is struggling.

**Cut list if behind:** model v2 (never needed), n8n, the Punjabi test sentences. Never cut: the hand-written test set, the Critic rejection, the replay mode, demo mode.

---

## 7. Risks and fixes

| Risk | Fix |
|---|---|
| iPhone has no Punjabi text-to-speech voice | Test on a real iPhone by 12:00. Fallback: Gemini or Google TTS audio from the server, or show Punjabi text and speak Spanish |
| Speech recognition fails for Punjabi in the browser | Record with MediaRecorder and transcribe on the server with Gemini (it takes audio) |
| Venue wifi drops | `?demo=1` replays cached SSE events and plans; phone hotspot as backup |
| Rate limits on 5 parallel agents | Agents on `claude-sonnet-5-5` (fast), Gemini as fallback through `LLM_PROVIDER`, cached results in demo mode |
| Vercel memory doesn't persist across requests | Upstash Redis from the Vercel Marketplace; fallback: encode the plan in the QR URL |
| Judges ask about privacy | Store no names (worker IDs only), no audio, and alerts expire at the end of the shift |

---

## 8. Kickoff prompt for Atharv's Opus session (plan mode)

```
Read CLAUDE.md and PLAN.md. Next.js here is v16, so read node_modules/next/dist/docs before writing code.
We have until 3:15 for features. Plan the build for Atharv's files only (section 5), against the
types in lib/types.ts (write that file first). Milestone 1, by 1:00: /command posts a crew request to
/api/plan, which streams 5 agents over SSE into an Agent Panel, then shows the final plan and colored
fields on a MapLibre map, using Replay-mode weather from data/replay-*.json (fake it if the file isn't there yet).
Then: Live mode via Open-Meteo, the Critic rejection and revise loop, the QR code to /crew/[id] via Upstash,
the alerts feed, and ?demo=1. Agents call lib/llm.ts (claude-sonnet-5-5 by default, Gemini fallback).
Flag anything risky for wifi, rate limits or iPhone Safari.
```
