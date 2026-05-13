# RefineGoals

RefineGoals is a local-first web tool for turning vague goals into concrete, AI-readable project dashboards. The MVP uses a ChatGPT-like conversation surface, a persistent goal-state panel, image reference uploads, Tavily search hooks, and Markdown dashboard documents.

## Current MVP

- Local-only Next.js app
- SQLite persistence through a small local database layer
- Chat sessions with stored messages
- Durable goal state:
  - intent
  - domain
  - target users
  - constraints
  - references
  - must-have features
  - nice-to-have features
  - risks
  - unknowns
  - decisions
  - completeness score
- Clarification-first behavior when user requests are unclear, underspecified, contradictory, or conflict with the current goal state
- Retry action on model/client failure messages so the last user request can be sent again
- Implementation-ready state at 85%+ completeness with dashboard HTML export and AI handoff Markdown export
- Empty starter sessions stay empty until the first real user message, so they do not create misleading handoff documents
- Provider abstraction for:
  - OpenRouter
  - DeepSeek
  - LM Studio OpenAI-compatible endpoint
  - Ollama OpenAI-compatible endpoint
- Tavily search provider hook
- Local image upload for UI/design, product/function, and mood/style references
- Image uploads are local-only, limited to image MIME types, and capped at 10MB per file
- Next.js development route indicator is disabled so the local UI does not show framework controls
- Dashboard document generation:
  - Goal Brief
  - Requirements
  - Technical Spec
  - AI Implementation Prompt

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run db:init
npm run dev
```

Open:

```text
http://localhost:3000
```

## Provider Configuration

Edit `.env`:

```text
OPENROUTER_API_KEY=""
OPENROUTER_MODEL="openai/gpt-4.1-mini"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
DEEPSEEK_MODEL="deepseek-v4-flash"
LOCAL_LLM_BASE_URL="http://localhost:1234/v1"
LOCAL_LLM_MODEL="local-model"
OLLAMA_BASE_URL="http://localhost:11434/v1"
OLLAMA_MODEL="llama3.1"
TAVILY_API_KEY=""
```

OpenRouter requires `OPENROUTER_API_KEY`. DeepSeek requires `DEEPSEEK_API_KEY`. LM Studio and Ollama are called through their OpenAI-compatible `/v1/chat/completions` endpoints.

Provider selection is explicit. If multiple providers and models are configured in `.env`, the app uses the provider currently selected in the chat composer. The selected provider then uses only its matching model variable:

- `OpenRouter` uses `OPENROUTER_MODEL`
- `DeepSeek` uses `DEEPSEEK_MODEL`
- `LM Studio` uses `LOCAL_LLM_MODEL`
- `Ollama` uses `OLLAMA_MODEL`

There is no automatic priority or fallback between configured providers yet. If the selected provider fails, the MVP falls back to the local rule-based draft so the session and dashboard still update.

For the direct DeepSeek API, use direct model names such as `deepseek-v4-flash` or `deepseek-v4-pro`. OpenRouter-style names such as `deepseek/deepseek-v4-pro` are automatically normalized only when the selected provider is `DeepSeek`.

If no provider key or local model is available, the app still creates a fallback local goal draft so the UI and persistence flow remain usable.

Search is best-effort. Tavily text and image search failures, network errors, or timeouts do not fail the chat request; the model receives an empty search summary and the user can continue refining the goal.

## Development

```powershell
npm run lint
npm run build
npm run db:init
```

## Product Direction

The MVP is intentionally local-first. The code keeps provider, search, storage, and document-generation boundaries separate so the project can later grow into a SaaS product with auth, team workspaces, cloud storage, and billing.

## Goal Refinement Behavior

The assistant should not force uncertain user input into confirmed decisions. If a request is ambiguous or conflicts with the current goal state, it should:

- restate what it understood
- identify unclear or conflicting points
- ask targeted clarification questions
- keep uncertain items in `unknowns`
- only move confirmed answers into `decisions`

If the user cannot choose between options or asks for a recommendation, the assistant should actively recommend one default. For recommendation-style messages, the API also enables search automatically even when the search toggle is off, then combines search evidence with implementation tradeoffs and product reasoning.

For UX, dashboard, visualization, or interaction choices, the assistant should ask only one follow-up question at a time and provide concrete selectable options first. Each UX option can include a web image reference from Tavily image search or a generated wireframe-style visual hint when no suitable image is available.

If the user's answer is vague or partial, the assistant should recommend a practical default, mark it as an assumption awaiting confirmation, and ask one question that lets the user accept or override the recommendation.

Goal clarity is considered implementation-ready when the score is roughly 85% or higher and the remaining unknowns are non-blocking. In practice, another coding AI should be able to identify the target users, primary workflow, required outputs, data/API boundaries, core constraints, failure behavior, and definition of done from the generated documents alone. A score below that should keep driving one high-leverage question or recommendation at a time.

If a model response omits `nextQuestions` while `unknowns` still contains open items, the API adds one follow-up question from the highest-priority remaining unknown so the refinement loop does not stall at high completeness scores.

When a session reaches implementation-ready status, the UI shows a ready banner with direct actions to inspect the dashboard in the center panel, export the full dashboard as HTML, and export an AI-agent handoff Markdown file whose filename is derived from the current session title.

The dashboard includes an artifact usage guide so users know what to do next. The recommended handoff is the full generated Handoff Markdown file shown in the dashboard guide. `AI Implementation Prompt` is one execution-focused section inside that handoff, not the default standalone artifact. The dashboard HTML is for human review, sharing, and browsing the generated documents.

Generated documents should be useful as standalone handoff artifacts. In particular, `Technical Spec` and `AI Implementation Prompt` are expected to contain enough context, modules, data model, API surface, UX flow, build order, risks, and definition of done for another AI model to implement the program without reading the original chat.

Document quality bar:

- confirmed decisions are separated from assumptions
- unresolved unknowns stay visible instead of being silently guessed
- implementation modules and data/API contracts are explicit
- failure behavior and privacy/security notes are included
- retry behavior is available for model/client response failures
- implementation-ready sessions expose dashboard HTML export and Handoff Markdown export names derived from the current session title
- dashboards explain whether each export is intended for human review or AI-agent implementation handoff
- empty starter sessions do not generate documents until a real intent exists
- search failures degrade to no-search context instead of breaking chat persistence
- model responses that omit `nextQuestions` still get one generated follow-up while `unknowns` has open items
- model fallback preserves existing goal-state fields unless explicit replacements are returned
- empty starter sessions can still be seeded from the first real user message if provider fallback is used
- test matrix and final implementation checklist are included
- a coding AI can use the generated handoff docs without needing the chat transcript
