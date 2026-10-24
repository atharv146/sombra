# Sombra UI Guidelines

Instructions for the coding agent. Read this whole file, then `fonts.md`, then every image in this folder (inspiration screenshots) before changing any code.

## 0. Your job

Improve the visual design and motion of Sombra so it looks hand-designed, calm, and professional, and does not look AI-generated or vibecoded. Do not change functionality, API routes, the rules engine, agent logic, or data flow. This is a design pass only.

Sombra is an AI command center that keeps Central Valley farm crews safe in heat and wildfire smoke. A crew lead (mayordomo) plans tomorrow's shifts, AI agents build a plan around the live forecast and California's heat law, and every worker gets it on their phone in Spanish or Punjabi. The product is serious, humane, and urgent. The design should feel like a trustworthy public-safety instrument, not a startup landing page.

Two surfaces, two personalities:

- **Command center (laptop):** editorial and data-forward, like a newsroom weather graphic.
- **Worker phone (`/crew/[id]`, `/crew/latest`):** one thing at a time, huge type, familiar like a messaging app, readable in direct sun.

## 1. Core rule

**Saturated color only ever means data.** Chrome, backgrounds, buttons, and text are neutral plus one restrained brand color. Bright color appears only for heat levels, alerts, and status.

## 2. Process (follow in order)

1. Read `fonts.md` and view every inspiration screenshot in this folder. Write a short `design-notes.md` listing, for each screenshot, 1 to 3 specific things worth borrowing (layout, spacing, type scale, motion, color behavior). Borrow principles, never copy a design.
2. Audit the current UI against Section 3 (the "tells") and Section 4. Add the findings to `design-notes.md` as a prioritized list.
3. Define design tokens (Section 5) once, in one place, and use only tokens afterward. No hard-coded colors, sizes, or durations in components.
4. Fix surfaces in this order: first screen of the command center, map and heat timelines, agents Floor(step 7), impact scorecard, usual-vs-Sombra timelines, Play the Day, worker phone, heat alert takeover.
5. Verify (Section 10). Fix what fails.
6. Finish with a short summary of what changed and anything you could not resolve.

## 3. Things that make a UI look vibecoded (avoid all of these)

| Tell | Do instead |
|---|---|
| Harsh gradients, radial orbs, neon, purple and black, rainbow coloring, basic pastels | Warm neutral palette. No decorative gradients. The only gradient-like element allowed is data encoding, and prefer hard color bands at rule thresholds |
| Pure white background (#fff) | Warm paper tone. Provide a darker pre-dawn theme for early shifts if it fits |
| Inter, Geist, Space Grotesk | Use only the fonts in `fonts.md` (Section 6) |
| Lucide icons, sparkle icons, emojis | No emojis anywhere, including generated text. No sparkle icons. Prefer words over icons. Draw a small custom SVG set (sun, shade, water, cooler, alert, mic) with one consistent stroke weight |
| Three feature cards in a row, bento grids | One hero canvas per screen, a timeline spine, typographic tables with hairline dividers. Use asymmetry and clear hierarchy |
| Drop shadows, soft rounded corners everywhere, liquid glass, blur | Flat surfaces, 1px borders, small radii on laptop (4 to 6px), larger radii only on phone buttons. Separate layers with contrast, not shadow. No glass or backdrop blur. At most one overlay shadow for modals |
| Colored left stripe on cards | Full-width alert bands or filled backgrounds |
| Dot grids, animated arrows, hover animations for show, floating decorative shapes | None. Motion must carry meaning (Section 8) |
| Terminal window styling | Present the agents as colleagues (Section 7) |
| Checkmark bullets, "it's not X, it's Y" copy, em dashes | Banned (Section 9) |
| Fake testimonials | Do not invent quotes. Label any persona as an example |
| Three pricing tiers | Not applicable. Do not add marketing sections |
| No skeleton loaders | Add skeleton and status states for every async surface (agents, map, forecast) |
| No real product demos | The product itself is the demo. Keep Play the Day and the replay path polished |
| No privacy policy or terms | Add short plain-language notes (Section 9) |
| Generic "AI app" look | Every visual choice should trace back to heat, shade, time of day, or the crew |

These are heuristics. A Lucide icon or a rounded corner used with intent is fine. The real tell is a default used without a reason, so be able to justify each choice.
The Agent Floor vignettes are custom illustrations in the same monoline style.

## 4. Layout and visual direction

**Command center**

- The first screen leads with one very large number (the forecast peak, for example 114°F) set in the display face, with a single plain sentence of context beneath it. The map and timelines follow.
- The map is full-bleed with a muted basemap. Fields are shaded in banded heat colors at the selected hour. Labels are plain text (crew name and temperature), not floating pins or cards.
- The hour slider and Heat wave / Live toggle are quiet controls with clear labels. Scrubbing updates map colors smoothly.
- The impact scorecard is a table with large tabular numerals and before/after columns, not a row of stat tiles. One line per crew.
- Usual day vs Sombra timelines are drawn over the heat colors with am/pm times and a legend. When the Crítico agent rejects the usual day, show it visually: the unsafe blocks get a hatched warning pattern, then the timeline morphs into the Sombra plan. This is the signature moment of the product. Make it excellent.
- Use whitespace and a strong type scale for hierarchy, not boxes inside boxes.
- Optional signature touch if it reads as tasteful: during Play the Day, the page's background tone shifts subtly with the sun (cool before dawn, warm at midday). It must stay subtle and must never reduce contrast.
- The Agent Floor sits where the agents panel is today. It is compact and must not push the map or timelines below the fold on a 1440x900 screen.

**Worker phone**

- One primary thing on screen: the current block in very large type, with time remaining and a clear next step (for example "Shade break in 12 min", with "+$3.67" on paid breaks).
- Language picker (Español, ਪੰਜਾਬੀ, English) is simple and large. Crew pick is a clean list.
- The thread with the crew boss looks like a familiar messaging thread: timestamped, clearly separated sender and receiver, large text.
- The push-to-talk button is big and reachable by thumb, with a ring that reacts to the live audio level and a visible seconds counter.
- The heat alert takeover is full-screen, loud, and unmistakable: huge text, alarm, vibration. This is the one place where very loud color is correct.
- Minimum tap target 48px. Body text 18px or larger. Test readability outdoors (high contrast, no thin weights).

## 5. Color and tokens

You (the agent) choose the color scheme. Constraints:

- Warm neutral base (paper, ink, hairline, muted text). No pure white, no pure black.
- One brand color used sparingly for the Sombra plan, primary actions, and focus. It should suggest shade and calm.
- A banded 5-level heat scale for data, modeled on the NOAA/CDC HeatRisk convention that Americans already recognize: green, yellow, orange, red, magenta (magenta is the extreme level). Band the colors at the rules engine's thresholds as hard steps. Do not claim this is the official HeatRisk index. Do not use the heat colors for anything decorative.
- Meet WCAG AA contrast (4.5:1 text, 3:1 large text and UI) for every text and background pair, in both themes if you build two.
- Never rely on color alone. Pair every heat level with a text label or pattern so colorblind users can read it.
- Interpolate color changes in OKLCH so transitions look smooth.

Define everything as CSS variables (or the project's equivalent) in one tokens file: colors, type scale, spacing scale, radii, border widths, durations, easing curves, z-index. Components use tokens only.

## 6. Typography

Read `fonts.md` for the exact font files and names. The selected fonts are:

- **Array Regular**
- **Zodiac Regular**
- **General Sans Semibold**

Rules:

- Use only these three families. Do not add other families except a required script fallback (below).
- Suggested starting roles (verify by rendering a type specimen and checking against the screenshots, then adjust if something reads poorly):
  - Zodiac Regular: display, large hero numbers (temperatures, scorecard figures), page headlines.
  - General Sans Semibold: UI labels, buttons, navigation, table headers, small-caps role labels, worker block titles.
  - Array Regular: supporting display and data text, and body paragraphs if it reads well at 16px or larger. If paragraph readability suffers, pick the best of the three for running text and note the decision in `design-notes.md`.
- Assign each font one consistent job. Do not mix them randomly.
- Use tabular numerals for every changing number (`font-variant-numeric: tabular-nums`). If a font lacks tabular figures, give counters a fixed-width container so they never jitter.
- Check glyph coverage for Spanish (á é í ó ú ñ ¿ ¡). If any glyph is missing, fix it.
- None of these fonts are expected to support Gurmukhi (Punjabi). Add a Punjabi-capable fallback (for example Noto Sans Gurmukhi) in the font stack, and match its weight and size so Punjabi text looks balanced next to Latin text. Check Punjabi screens specifically.
- Load fonts with `@font-face`, `font-display: swap`, and preload the critical files. Define a sensible system fallback stack.
- Use a clear modular type scale (for example 1.25 ratio) defined as tokens. Avoid more than 5 text sizes per screen.

## 7. Agent Floor (Cielo, Ley, Cuadrilla, Voz, Crítico, Medic)

The agents are the heart of the demo. Judges should be able to watch them work. Replace the plain agents panel with a compact, illustrated, interactive band called the **Agent Floor**. Each agent gets a small vignette, based on its name, that physically shows what it is doing with real data. It must stay compact. It never takes over the screen.

### 7.1 Layout

- One continuous scene, not a grid of cards. A thin baseline path (the "line") runs left to right. Each agent's vignette sits on it. Under each vignette: the agent name (General Sans Semibold, small caps), a short role phrase, and the model name in small muted text.
- Collapsed height: 160 to 200px on laptop, and never more than about 25% of the viewport height.
- Order along the line must follow the real orchestration order in the code. Read the orchestrator to find it. Do not assume the order in the table below. A likely order is Cielo, Cuadrilla, Ley, Crítico, Voz, but verify.
- Medic sits at the right end, separated by a gap, labeled "on check-in". It is dormant until a worker reports symptoms.
- Click, tap, or press Enter on a vignette to open a detail drawer directly beneath the band (max 320px). It pushes content down smoothly. No overlay, no modal. One drawer at a time. Esc closes it. The drawer shows that agent's real inputs, outputs, model, and timing.
- While the pipeline runs, the active agent is highlighted automatically. Do not force a drawer open. If the user has pinned a drawer, do not steal focus.
- Below 768px width, the band becomes a horizontally scrollable strip with scroll snap, and the drawer opens below it.

### 7.2 States

Every vignette supports these states, each visually distinct:

- **Idle:** muted line art only, no animation.
- **Working:** the vignette animates with its own behavior (7.4) and the status line shows plain-language progress (for example "Reading hour 9 of 24").
- **Handing off:** a token travels to the next agent (7.3).
- **Settled:** animation stops and the illustration rests in a finished pose. Do not use checkmarks.
- **Revising:** only Crítico and Cuadrilla. See 7.4.
- **Fallback:** if an agent timed out and the rules fallback ran, show it muted with the label "rules fallback". Never hide a failure.
- **Replay:** `?demo=1` and Play the Day drive the same visuals from recorded data.

### 7.3 Handoff tokens

Tiny shapes travel along the line between agents, one per payload type: forecast, plan, rule report, verdict, briefing. Each takes 500 to 700ms with eased motion. On hover or focus, a token shows a small label with real counts (for example "24 hourly readings"). When Crítico rejects, a "revision" token travels back to Cuadrilla along an arc, Cuadrilla visibly reworks, and the plan moves forward again. Crítico can reject only once, so show "revision 1 of 1 used".

### 7.4 Per-agent vignettes

**Cielo (sky scout)** reads hourly temperature, humidity, sun, wind, and PM2.5 per field, turned into WBGT bands.
- Visual: a small sky dome over a strip of field. A sun travels along an arc keyed to the hour. A thermometer column rises and falls with that hour's temperature. Wind appears as a few streak lines whose length and angle follow speed and direction. PM2.5 appears as a haze of small dots that thicken and drift with the value (cap at about 60 dots). Beneath the dome, a row of 24 thin bars fills left to right in banded heat colors as Cielo reads each hour.
- Interaction: hover or scrub an hour to read temperature, humidity, sun, wind, and PM2.5. Switching the selected field switches the dataset.
- Drawer: hourly table for the selected field.
- Binds to the outputs of `weather.ts` and `heat.ts`.

**Ley (the law)** checks the plan against the rules engine and cites subsections.
- Visual: a ruled ledger page. As each rules result arrives, a line is written in and then stamped. A pass is a quiet ink stamp. A violation is a hatched alert stamp with the subsection number. Show paid cool-downs, water, and shade as separate line items. Avoid scales of justice, gavels, and other clichés.
- Interaction: click a line to highlight the affected hours and crews on the timeline and map.
- Drawer: a clean table of rule, subsection, result, and hours affected.
- Show only what `rules.ts` returns. No free-form legal claims, ever.

**Cuadrilla (the crew)** plans start times, field order, breaks, water (1 qt per worker per hour), and shade trailers.
- Visual: a miniature top-down map of the three fields with small abstract worker pictograms (simple head-and-shoulders marks, one per worker, or one per few workers if it gets crowded). They move between fields in the planned order, queue at shade trailers during breaks, and a water gauge drains and refills on the 1 qt per worker per hour rule. A clock hand shows each crew's start time.
- Keep the figures dignified and neutral: no costumes, hats, props, or caricature of any kind.
- During revision, the figures visibly reshuffle into the new order.
- Interaction: scrub the day. Hover a crew for start time, field order, and breaks. Click a crew to focus it in the timeline and crew editor.
- Binds to Cielo's output and the crew input.

**Voz (the voice)** writes Spanish and Punjabi briefings at a 5th-grade reading level and sends them to TTS.
- Visual: a speech shape emitting ripples, with a live waveform line. While writing, the briefing appears as short lines. During playback, the waveform follows the real audio amplitude (Web Audio `AnalyserNode`). If that is not possible, fall back to a clearly synthetic envelope.
- Interaction: toggle Español, ਪੰਜਾਬੀ, and English. Play or pause the briefing. Show the reading-level target as a small label.
- Use the real TTS audio that already exists. Do not add new audio.

**Crítico (the critic)** red-teams the plan and can reject it once, which triggers a revision.
- Visual: a miniature copy of the day's timeline with a red-pen markup layer. The pen draws controlled, consistent strokes (animate SVG `stroke-dashoffset`): a circle around problem blocks, a strike through unsafe hours, short margin ticks. On rejection, a typographic "Rejected" label with a hatch pattern appears, and the revision token arcs back to Cuadrilla. After revision, the pen re-reads and the marks lighten to a resolved state.
- Interaction: click a mark to see the reason and the linked timeline block.
- Drawer: the list of objections with the evidence for each.

**Medic (on check-in)** gives a second opinion on a worker's symptoms plus a first-aid checklist.
- Visual: a flat dormant line that wakes into a pulse line when a check-in arrives. The symptoms resolve into a small triage sequence, then the first-aid checklist items reveal one at a time.
- Do not use a red cross or any protected emblem.
- Interaction: click to open the triage result and the checklist. Show how the second opinion compares with the first routing advice.
- Optional: a tiny version beside the advice in the worker's thread. The red banner and alarm for the boss stay exactly as they are.
- Show only what the triage result contains. Do not add medical claims.

### 7.5 Data binding rules

- Every animation is driven by the agent's real state and output, through a typed view model per agent. No decorative loops. The only allowed idle motion is a subtle opacity "breathing" while a request is in flight.
- If real data is missing, show idle line art with a skeleton. Never invent numbers.
- Play the Day and `?demo=1` replay must drive the same view models so every vignette works in replay.
- Read the existing streaming and orchestration code first and reuse its events. Do not change agent logic, prompts' behavior, or the rules engine.

### 7.6 Illustration style

- Monoline SVG with one consistent stroke weight, warm neutral ink, and the brand color to mark the currently active agent.
- Saturated color appears only where it encodes data: heat bands in Cielo, violation stamps in Ley, markup in Crítico, severity in Medic. Follow the core rule in Section 1.
- No glow, no blur, no glass, no sparkles, no cartoon mascots, no faces. Each agent's vignette doubles as its identity glyph.
- Use the fonts from `fonts.md`. Tabular numerals on every changing number.
- The tone is a precise public-safety instrument with craft, not playful.

### 7.7 Performance, accessibility, reduced motion

- Use SVG with CSS or the Web Animations API. Animate only `transform` and `opacity` (plus `stroke-dashoffset` for pen strokes). Add no heavy libraries.
- Pause all animation when the band is offscreen (`IntersectionObserver`) or the tab is hidden. Cap particle counts. Hold 60fps on a mid-range phone profile.
- Each vignette has an accessible name and a live-region text line of what it is doing. Nothing is communicated by animation alone. The band is keyboard navigable with visible focus rings.
- Under `prefers-reduced-motion`, replace movement with instant state changes or crossfades. The information stays the same.

### 7.8 Copy

- Status lines are short, plain, and concrete. Examples: "Reading hour 9 of 24", "Checking shade rule, 7 of 9", "Revising Field C order".
- No em dashes, no emojis, no "it's not X, it's Y" phrasing. Update any agent status or display strings that violate this.

## 8. Motion (buttery, with purpose)

- Animate only `transform` and `opacity`. Do not animate layout properties.
- Use one easing curve family and a small set of durations as tokens: about 150 to 250ms for UI feedback, 400 to 700ms for story moments.
- Use spring or smooth ease-out for movement. Avoid linear motion and avoid bounce.
- Use shared-element transitions (View Transitions API where supported) for selecting a field, opening a crew channel, and moving between plan states.
- Slider scrub updates the map color with eased interpolation, with no flicker.
- Number changes use a quick tick or crossfade with tabular figures.
- Press states respond within 100ms. Buttons, mic, and toggles have clear pressed, focus, and disabled states.
- Play the Day (4am to 7pm in about 25 seconds) is the hero demo. Make it smooth: the time rail advances steadily, counters tick, the story ticker updates calmly, and the first deadly-hour alert lands as a clear moment.
- Respect `prefers-reduced-motion` with calm, instant alternatives.
- Prefer CSS and the View Transitions API. Add a small animation library only if it is clearly needed, and note why.
- No parallax, no floating shapes, no looping decorative animation.
- Agent animations show real work: sun arcs by hour, rules stamped as results arrive, crew pictograms moving between fields, waveform following audio, pen strokes drawing, a pulse line waking for Medic.
- Handoff tokens travel the line in 500 to 700ms. The Crítico rejection and Cuadrilla revision loop is a signature moment. Make it clear and smooth.

## 9. Copy, tone, and trust

- Write like a person: direct, concrete, numbers first. Example: "Tomorrow reaches 114°F at 3 pm. Fields A and C are unsafe from 1 to 6 pm. Start at 4 am."
- No em dashes anywhere in the UI or in generated text. No "it's not X, it's Y" constructions. No hype words. No checkmark bullet lists.
- Apply the same rules to the agents. Update their system prompts so their output has no em dashes, no emojis, and no "it's not X, it's Y" phrasing, but only edit prompt wording related to style. Do not alter their logic or rules behavior.
- Worker-facing text uses simple words and short sentences in each language. Keep Spanish and Punjabi strings accurate. If you are unsure about a translation, leave it unchanged and flag it in your summary.
- Show data provenance in small muted text (for example "Forecast: NWS" and "Rule: Cal/OSHA heat standard") so the plan feels trustworthy.
- Add a short plain-language privacy note on the worker screen covering: voice is recorded and transcribed to send your message, who can see messages (your crew boss), and that Sombra supports but does not replace legal compliance. Keep it honest and brief. Do not paste legal boilerplate.
- Label example crews and data as examples where applicable.

## 10. Accessibility and verification

Before finishing, check all of the following and fix failures:

- Screenshots at 1440px, 768px, and 390px widths, for every screen. Nothing overflows or wraps awkwardly. The crew editor wraps cleanly on phones.
- Contrast passes WCAG AA for every text and UI pair.
- Full keyboard navigation on the command center with visible focus rings.
- Screen reader labels on the map, slider, and mic button.
- All three languages render correctly, including Punjabi, with no missing glyphs or clipped text.
- Reduced-motion mode works.
- Skeleton and error states exist for slow or failed AI calls, and the `?demo=1` replay path still works.
- No console errors. No layout shift when fonts load.
- Performance is smooth at 60fps during Play the Day on a mid-range phone profile.
- Each of the six vignettes renders correctly in idle, working, settled, and fallback states.
- The Crítico rejection and revision loop plays correctly, once, in both live and `?demo=1` replay.
- Medic wakes when a worker check-in arrives and stays dormant otherwise.
- The Agent Floor pauses offscreen and holds 60fps on a mid-range phone profile.
- Every vignette has an accessible name, a live status line, and works by keyboard.

## 11. Definition of done

- A stranger could not tell which AI tool, if any, helped build it.
- Saturated color appears only on data and alerts.
- Every font use follows `fonts.md` and Section 6.
- Every item in Section 3 is either absent or deliberately justified in `design-notes.md`.
- The first screen, the Crítico rejection morph, Play the Day, and the worker alert takeover each feel intentional and polished.
- Functionality is unchanged.
- A viewer can watch the Agent Floor and understand what each agent is doing without reading any text.