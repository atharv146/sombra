# Sombra: build plan (Sierra Hacks 2026)

> **Sombra** (Spanish for "shade") is an AI command center that keeps Central Valley farm crews safe in heat and wildfire smoke.
> A crew lead says what tomorrow looks like. A team of AI agents builds a shift plan around the live forecast and California's heat law, sends it to every worker's phone in Spanish or Punjabi, and listens when a worker says "me siento mareado" ("I feel dizzy").

**Prompt:** solve a real challenge in Central Valley agriculture, transportation, education or community life. Show who it helps.
**Who it helps:** a crew lead (*mayordomo*) for a farm labor contractor near Manteca, and the 30 to 40 workers on their crew.

---

## 0. Do these in the next 15 minutes

1. **Check the deadline.** Devpost says **8:00pm EDT, which is 5:00pm here**, not 6:15. Ask on Discord. Until they answer, plan to **submit a draft by 4:45pm**. Devpost lets you edit until the deadline, so submitting early costs nothing.
2. **AI/ML track rules:** done. Section 4 shows how we meet each one. Submit to the main track **and** the AI/ML track.
3. **Lock the team.** Push this repo to GitHub, invite partners, and assign roles from section 5.
4. **Use Opus, not Sonnet, as the builder.** Sonnet is fine for small mechanical edits only. If Opus usage gets tight after 1pm, switch to Sonnet for polish, not for core logic.

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

1. **(15s) Person.** "Rosa runs a 38-person crew picking tomatoes outside Manteca. On a 106° day she has to schedule shade, water, rest breaks and start times by law, for workers who speak three languages. Farmworkers die of heat at about 20 times the rate of other workers." *(Partner C verifies this figure and cites the source.)*
2. **(40s) Command center.** Choose the **July heat-wave replay**. Rosa types or says: *"Mañana: 3 crews, tomatoes at French Camp, cherries at Linden, 6 new workers."*
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

**Rules to encode** (Partner C checks each against the text on dir.ca.gov by 11:30):
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

1. **Our own trained model: a multilingual heat-illness triage classifier** (Partner A).
   - **Labels:** `ok`, `warning` (cramps, heavy sweating, thirst), `heat_exhaustion` (dizzy, headache, nausea, weak), `emergency` (confused, fainted, stopped sweating, hot dry skin, slurred speech). Symptom lists come from CDC/NIOSH.
   - **Data:** about 800 utterances in Spanish, Punjabi, English and Spanglish. Generate them with Claude from the symptom lists and hand-check 50. **The test set is written by teammates, not generated**, so the evaluation is honest.
   - **Model v1 (guaranteed in 45 min):** character n-gram TF-IDF plus logistic regression in scikit-learn. Export the weights to `public/model/triage.json` and run inference in TypeScript (a dot product and softmax).
   - **Model v2 (if time):** multilingual sentence embeddings (`paraphrase-multilingual-MiniLM-L12-v2`) plus logistic regression. Report both models in a comparison table.
   - **Metric that matters:** recall on `emergency`. Lower the threshold until no emergency is missed, and show the confusion matrix on the model card.
   - **Safety floor:** emergency keywords always escalate, whatever the model says.
2. **Physics model:** WBGT from temperature, humidity, solar radiation and wind (Liljegren or a simplified approximation). It explains why a humid 92° can be worse than a dry 97°.
3. **Agent orchestration:** parallel agents, a Critic-and-revise loop, and retrieval-style grounding in the rule text.

**An `/about/model` page (the model card)** shows the dataset, the metrics table, the confusion matrix and known limits. AI/ML judges read this, and it doubles as Devpost material.

---

## 5. Team roles (nobody touches anyone else's files)

| Person | Owns (files) | Tools | Deliverable by 1:00 gate |
|---|---|---|---|
| **Atharv: driver and integrator** | `app/command/**`, `app/api/plan/**`, `lib/llm.ts`, `lib/agents/**`, `lib/types.ts`, the map | Claude Code on **Opus**, local | Prompt to plan on the map, ugly, end to end |
| **Partner A: ML** | `ml/**` (notebook + data), `lib/triage.ts`, `lib/heat.ts`, `public/model/**`, `app/about/model/**` | Colab or local Python, any Claude/Gemini chat; or a cloud Claude Code session on the $100 credit, scoped to these paths | `triage.json` v1 and a `classify(text)` function that passes 5 sample sentences |
| **Partner B: worker phone** | `app/crew/**`, `app/api/checkin/**`, `lib/speech.ts` | A second Claude Code session (cloud or worktree) using the credits | `/crew/demo` shows a hardcoded plan, reads it aloud in Spanish, and records voice to `/api/checkin` |
| **Partner C: story, data, rules, pitch** | `lib/rules.ts` (thresholds only), `data/fields.json`, `data/replay-*.json`, `docs/**`, slides, video, Devpost, n8n | Browser, free Claude, Godly, Cmd+Shift+5 | Rule text checked, 3 real field coordinates, a replay-date JSON, the "who it helps" story and stats with sources |

**Our actual team is 2 people:**
- **Atharv** owns his files from the table above.
- **A cloud Claude Code session** on the $100 credits does Partner B's work (`/crew`), with Atharv steering it.
- **The teammate** takes Partners A and C, using no Claude Code: Colab with its built-in Gemini, plus free Claude chat. If they don't know Python, they only make the dataset and the hand-written test set, and the cloud session does the training.
- **Cut:** n8n and model v2.

**Unique angle from ag-labor apps (FieldClock, Hectre):** piece-rate workers skip breaks because a break costs them money. California requires paid rest and recovery periods for piece-rate workers (Labor Code 226.2; the teammate verifies this). The phone shows **"Descanso pagado: $X"** ("Paid break: $X") during every cool-down.

**The contract that keeps everyone unblocked:** at 11:00 Atharv commits `lib/types.ts` (`Field`, `Crew`, `HourlyRisk`, `ShiftPlan`, `AgentEvent`, `CheckIn`, `TriageResult`). Everyone builds against these types with fake data until the real pieces land.

**Git:** one branch per person, small commits, and Atharv merges at 1:00, 3:00 and 4:15. Nobody else edits `package.json`. Tell Atharv and he adds the dependency.

**Sponsor shot:** Partner C builds one n8n workflow: "plan approved" webhook, then a Telegram/Discord message to the crew channel. It takes about 30 minutes and lets us enter for a "best use of n8n" prize if there is one.

**2pm ML workshop:** send Partner C (or A, if their model is done) for 20 minutes. Write down any words the organizers use for what "good ML" means and reuse them on the model card.

---

## 6. Timeline (assumes a 5:00pm PT deadline)

| Time | Atharv | A (ML) | B (phone) | C (story) | Gate |
|---|---|---|---|---|---|
| 10:45–11:00 | Push repo, Opus plan mode with the kickoff prompt below | Set up Colab, start generating data | Start the `/crew` skeleton | Discord deadline question, rule text check | Roles locked |
| 11:00 | Commit `lib/types.ts` | | | | Contract is in |
| 11:00–1:00 | Agent engine (SSE), `/api/plan`, map, Live/Replay toggle | Model v1 trained, `triage.json` exported, `lib/heat.ts` | TTS in Spanish and Punjabi, voice record, check-in route | Fields, replay JSON, story, stats, slide outline | **1:00: one full flow works** |
| 1:00–1:20 | Lunch. **Deploy to Vercel.** Check `/usage` | Lunch | Lunch | Lunch, screenshot the flow | Live URL |
| 1:20–3:15 | Critic-and-revise loop, QR code, alerts feed, design pass (Godly refs + Playwright) | Model v2, confusion matrix, `/about/model` | Phone polish, real phone tests on iPhone and Android | n8n, slides, attend the ML workshop | **3:15: feature freeze** |
| 3:15–4:00 | Bugs only, `?demo=1` cache, final deploy | Model-card text for Devpost | Test the full loop on 3 phones | Record the 2-minute video | Video done |
| 4:00–4:45 | Devpost technical sections | Devpost AI/ML section | Screenshots | Devpost story sections, **submit** | **4:45: submitted** |
| 4:45–6:30 | Rehearse 3 times. If the deadline turns out later, polish only, and redeploy only after checking the build | | | | Under 2 minutes |

**If you're behind at 1:00:** cut the phone voice check-in to a typed check-in, and cut model v2. Never cut the Critic rejection, the replay mode or demo mode.

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
