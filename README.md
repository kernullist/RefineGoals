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
- Provider abstraction for:
  - OpenRouter
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
LOCAL_LLM_BASE_URL="http://localhost:1234/v1"
LOCAL_LLM_MODEL="local-model"
OLLAMA_BASE_URL="http://localhost:11434/v1"
OLLAMA_MODEL="llama3.1"
TAVILY_API_KEY=""
```

OpenRouter requires `OPENROUTER_API_KEY`. LM Studio and Ollama are called through their OpenAI-compatible `/v1/chat/completions` endpoints.

If no provider key or local model is available, the app still creates a fallback local goal draft so the UI and persistence flow remain usable.

## Development

```powershell
npm run lint
npm run build
npm run db:init
```

## Product Direction

The MVP is intentionally local-first. The code keeps provider, search, storage, and document-generation boundaries separate so the project can later grow into a SaaS product with auth, team workspaces, cloud storage, and billing.
