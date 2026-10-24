@AGENTS.md

# Project: Sombra, built at Sierra Hacks 2026 (12-hour hackathon, judged by humans)
Prompt: solve a real challenge in Central Valley agriculture, transportation, education or community life; show who it helps.
User: a farm labor contractor crew lead near Manteca and their Spanish- and Punjabi-speaking crew. Full plan: @PLAN.md

Stack: Next.js 16 App Router, TypeScript, Tailwind 4. AI calls only through app/api routes via lib/llm.ts. Deploy: Vercel.
Priorities, in order: 1) the demo flow works every time (including ?demo=1 offline replay), 2) it looks designed, not AI-generated, 3) speed.
Ownership: only edit the files your person owns in PLAN.md section 5. Shared types live in lib/types.ts (Atharv owns it).
Safety logic is deterministic: lib/rules.ts decides compliance; LLM agents draft and explain but never override it.

Design: follow the frontend-design and design-taste-frontend skills. No purple/blue gradients, no Inter-only type,
no generic 3-card grids, no emoji icons. One distinctive display font + one text font. Motion via transitions-dev.
Always handle loading, empty and error states. Mobile layout must work (judges use phones; /crew/* is phone-first).
Never commit API keys; use .env.local. Keep files small. After UI changes, use Playwright to screenshot and self-review.
