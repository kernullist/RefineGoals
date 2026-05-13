import { GoalState } from "@/lib/goal-state";

export type DashboardDocument = {
  kind: string;
  title: string;
  content: string;
};

function list(items: string[]): string {
  if (items.length === 0) {
    return "- TBD";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function numbered(items: string[]): string {
  if (items.length === 0) {
    return "1. TBD";
  }

  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function buildDashboardDocuments(state: GoalState): DashboardDocument[] {
  return [
    {
      kind: "goal-brief",
      title: "Goal Brief",
      content: `# ${state.title}

## Intent
${state.rawIntent || "TBD"}

## Domain
${state.domain}

## Target Users
${state.targetUsers || "TBD"}

## Decisions
${list(state.decisions)}

## Open Assumptions
${list(state.unknowns)}

## Success Signal
- A future implementer can describe the target users, core workflow, required outputs, and implementation boundaries without reading the chat history.
`,
    },
    {
      kind: "requirements",
      title: "Requirements",
      content: `# Requirements

## Must Have
${list(state.mustHaveFeatures)}

## Nice To Have
${list(state.niceToHaveFeatures)}

## Constraints
${list(state.constraints)}

## Unknowns
${list(state.unknowns)}

## Functional Acceptance Criteria
${state.mustHaveFeatures.length === 0 ? "- TBD" : state.mustHaveFeatures
  .map((item) => `- Given the product is in use, when the user needs "${item}", then the workflow exposes it clearly and persists or exports the result when appropriate.`)
  .join("\n")}

## UX Acceptance Criteria
- The primary workflow must be visible without reading onboarding text.
- Important decisions, unknowns, and generated artifacts must be inspectable from the main dashboard.
- Long-running model, search, or generation work must show an in-context pending state.
- If a user cannot choose between options, the product should offer concrete choices and a recommended default.

## Non-Goals
- TBD unless explicitly decided.
`,
    },
    {
      kind: "technical-spec",
      title: "Technical Spec",
      content: `# Technical Spec

## Goal
${state.rawIntent || state.title}

## Current Product Decision Summary
${list(state.decisions)}

## Recommended Architecture
- Application shell: local-first web application unless the goal state says otherwise.
- AI layer: provider abstraction so hosted and local models can be swapped without changing product logic.
- Research layer: search provider abstraction for external evidence gathering.
- Storage layer: durable session, message, attachment, goal-state, and generated-document persistence.
- Export layer: generated Markdown documents that can be handed to another AI model or engineering team.

## Core Modules
- Session Manager: creates, lists, selects, deletes, and persists goal-refinement sessions.
- Conversation Engine: stores user/assistant turns, pending states, provider metadata, and follow-up choices.
- Goal State Engine: maintains confirmed decisions, assumptions, unknowns, risks, constraints, and completeness.
- Choice Generator: creates concrete selectable options for ambiguous UX, architecture, and product decisions.
- Research/Search Adapter: fetches web evidence and optional visual references for choice cards.
- Artifact Generator: emits implementation-grade documents from the current goal state.
- Export/Download UI: lets the user inspect and download generated Markdown artifacts.

## Data Model
- GoalSession: id, title, rawIntent, domain, targetUsers, constraints, references, mustHaveFeatures, niceToHaveFeatures, risks, unknowns, decisions, outputType, completenessScore, timestamps.
- Message: id, sessionId, role, content, metadata, createdAt.
- Attachment: id, sessionId, fileName, mimeType, path, purpose, createdAt.
- Document: id, sessionId, kind, title, content, timestamps.

## API Surface
- GET /api/sessions: list sessions with messages, attachments, and documents.
- POST /api/sessions: create a new local goal session.
- GET /api/sessions/:sessionId: load a full session.
- DELETE /api/sessions/:sessionId: delete a session and dependent records.
- POST /api/chat: append a user message, call the selected model, update goal state, regenerate documents.
- POST /api/upload: attach local image references to a session.

## Primary UX Flow
1. User creates or selects a session.
2. User describes a vague goal or uploads references.
3. App immediately shows the user's message and a pending assistant response.
4. Model updates the goal state, asks one high-leverage question, or offers concrete choices.
5. User selects a choice or answers the question.
6. Dashboard updates decisions, unknowns, risks, and generated documents.
7. User exports implementation-grade Markdown artifacts.

## Implementation Constraints
${list(state.constraints)}

## Product Risks
${list(state.risks)}

## Reference Inputs
${list(state.references)}

## Testing Strategy
- Unit test goal-state serialization and document generation.
- API test session create/load/delete and chat fallback behavior.
- UI test pending message display, provider selection persistence, session deletion, and panel scrolling.
- Manual test at least one hosted provider and one local provider path.
- Verify generated documents remain useful without chat history.
`,
    },
    {
      kind: "ai-implementation-prompt",
      title: "AI Implementation Prompt",
      content: `# AI Implementation Prompt

Build the following goal with production-quality implementation.

## Goal
${state.rawIntent || state.title}

## Context For The Implementing AI
You only have this document. Do not assume access to the original conversation. Treat every TBD as an explicit gap to resolve before implementation. Preserve confirmed decisions and do not silently convert unknowns into requirements.

## Required Features
${list(state.mustHaveFeatures)}

## Recommended Build Order
${numbered([
  "Create the data model and persistence layer for sessions, messages, attachments, goal state, and documents.",
  "Build the main app shell with session list, chat panel, and goal dashboard.",
  "Implement provider abstraction and at least one working hosted or local model provider.",
  "Implement search/research integration and visual choice references when relevant.",
  "Implement goal-state update and document generation from model output.",
  "Add export/download for generated Markdown artifacts.",
  "Add tests for persistence, API routes, document generation, and primary UI flows.",
])}

## Expected Screens Or Views
- Session list with create, select, and delete.
- Chat panel with optimistic user message and pending assistant response.
- Goal dashboard with decisions, requirements, unknowns, risks, references, and documents.
- Choice cards for ambiguous UX/product decisions, including a recommended option when appropriate.
- Document viewer/export controls.

## Data And API Requirements
- Persist all user-visible sessions and generated documents locally unless a later requirement says otherwise.
- Keep model-provider details out of UI business logic.
- Store provider metadata for each assistant message.
- Keep generated documents deterministic from the latest goal state where practical.

## Constraints
${list(state.constraints)}

## Decisions Already Made
${list(state.decisions)}

## Open Questions
${list(state.unknowns)}

## Risks To Handle
${list(state.risks)}

## Definition Of Done
- A new developer or AI model can implement the product from this document without needing the chat transcript.
- The primary workflow works end to end with persisted sessions.
- Ambiguous user input leads to a recommended default plus one confirmation question.
- Long-running model/search operations show visible progress.
- Generated artifacts are readable, downloadable, and aligned with the current goal state.
`,
    },
  ];
}
