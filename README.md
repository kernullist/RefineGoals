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
- Provider abstraction for:
  - OpenRouter
  - DeepSeek
  - LM Studio OpenAI-compatible endpoint
  - Ollama OpenAI-compatible endpoint
- Tavily search provider hook
- Local image upload for UI/design, product/function, and mood/style references
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
