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

function checkbox(items: string[]): string {
  if (items.length === 0) {
    return "- [ ] TBD";
  }

  return items.map((item) => `- [ ] ${item}`).join("\n");
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

## Handoff Readiness
- This document is a product brief, not the full implementation contract.
- Use Technical Spec and AI Implementation Prompt as the implementation source of truth.
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

## Requirement Traceability Checklist
${checkbox([
  "Every must-have feature has a visible UI entry point or API behavior.",
  "Every generated artifact can be traced back to goal-state fields.",
  "Every open question remains visible until answered or explicitly dismissed.",
  "Every provider/search/storage failure has a user-visible fallback or error state.",
])}
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

## Implementation Contract
- Treat confirmed decisions as requirements.
- Treat unknowns as unresolved assumptions that must be surfaced in the UI and documents.
- Do not silently implement a guessed answer for an unknown. Recommend a default and ask for confirmation.
- Preserve local-first behavior unless a later decision explicitly requires SaaS/cloud behavior.
- Generated documents must be regenerated from the latest goal state after every successful model turn.
- A coding AI should stop and ask for clarification only when an item blocks implementation and no recommended default is reasonable.

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

## State Transitions
1. New session: create empty goal state with raw user intent.
2. User message submitted: persist user message and show optimistic pending UI.
3. Research phase: optionally gather text/image evidence when search is enabled or recommendation is requested.
4. Model phase: produce assistant message, updated goal state, one next question, and optional selectable choices.
5. Validation phase: parse model output, preserve uncertain content in unknowns, and fall back gracefully on failure.
6. Persistence phase: update session, append assistant message, regenerate documents.
7. UI phase: replace pending response, refresh dashboard panels, keep panel scrolling isolated.

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

## Error And Fallback Behavior
- Model provider missing key: show provider-specific configuration error and keep the session usable.
- Model response is not strict JSON: extract JSON if possible; otherwise use the text as assistant content.
- Model/search timeout: keep pending UI visible until server returns; if a fallback is used, include the failure reason.
- Model/provider fallback must preserve existing goal-state fields unless the model explicitly returned replacements.
- Placeholder sessions should be seeded from the first real user message even when provider fallback is used.
- Image reference search fails: render a wireframe-style visual hint instead of blocking the response.
- Session deletion fails: leave the item in the list and avoid destructive local state changes.
- Upload fails: keep the session intact and surface a recoverable error.

## Security And Privacy Notes
- Local MVP stores session data and uploads on the local machine.
- Do not commit .env, local DB files, uploads, or generated private data.
- API keys must stay server-side and must never be exposed in client-rendered metadata.
- Uploaded images may contain sensitive product or design information; keep paths local unless cloud storage is explicitly added.
- Uploads must be image MIME types and should be capped to a product-defined size limit.
- Search snippets and image URLs are external evidence, not verified facts.

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

## Test Matrix
${checkbox([
  "Create a new session from a vague goal.",
  "Send a message and verify optimistic user bubble plus pending assistant bubble.",
  "Receive a model response and verify dashboard state changes.",
  "Ask an ambiguous question and verify exactly one follow-up question.",
  "Ask for a recommendation and verify search is forced when appropriate.",
  "Ask for UX options and verify selectable cards with image or wireframe preview.",
  "Delete the active session and verify selection moves safely.",
  "Regenerate and download all documents.",
  "Run without provider keys and verify fallback reason is visible.",
])}
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

## Implementation Mission
Build the smallest production-quality version that satisfies the confirmed goal state while keeping unresolved assumptions visible. Prefer a complete, reliable local MVP over a broad but shallow prototype.

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

## Suggested File/Module Boundaries
- App shell: layout, panel sizing, responsive behavior, and global navigation.
- Sessions API: create, list, load, delete sessions.
- Chat API: model call orchestration, search orchestration, parsing, fallback, and document regeneration.
- Storage layer: local database schema and persistence helpers.
- AI provider layer: provider config, model naming normalization, request/response handling.
- Search layer: text search, image search, evidence summarization, timeouts.
- Document layer: deterministic Markdown generation from goal state.
- UI components: message bubble, pending response, choice card, dashboard panel, document preview.

## Data And API Requirements
- Persist all user-visible sessions and generated documents locally unless a later requirement says otherwise.
- Keep model-provider details out of UI business logic.
- Store provider metadata for each assistant message.
- Keep generated documents deterministic from the latest goal state where practical.

## Prompting And Model Behavior Requirements
- Ask at most one main clarification question per response.
- If user input is vague, recommend a practical default and mark it as an assumption awaiting confirmation.
- If the user asks for a recommendation, use search evidence when available and explain the recommendation.
- If UX choices are needed, provide selectable options with visual references or wireframe-style hints.
- Keep confirmed decisions separate from unknowns.
- Do not overwrite unrelated goal-state fields just because the model response omitted them.
- Preserve existing goal-state arrays and scalar fields when a model response omits them.
- Preserve populated sessions during fallback, but treat a placeholder "new goal" session as seedable from the first real user message.

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

## Final Implementation Checklist
${checkbox([
  "No required workflow is represented only as placeholder text.",
  "All persistent data survives page refresh.",
  "All provider and search failures are recoverable.",
  "UI does not depend on browser extensions or client-only data for first render correctness.",
  "Left, center, and right panels scroll independently.",
  "Generated documents can be read independently from the chat history.",
  "README matches the implemented setup and behavior.",
])}
`,
    },
  ];
}
