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
`,
    },
    {
      kind: "technical-spec",
      title: "Technical Spec",
      content: `# Technical Spec

## Recommended Architecture
- Local-first web application
- Provider abstraction for OpenRouter, LM Studio, and Ollama
- Search provider abstraction with Tavily first
- SQLite-backed session, message, attachment, and document storage

## Product Risks
${list(state.risks)}

## Reference Inputs
${list(state.references)}
`,
    },
    {
      kind: "ai-implementation-prompt",
      title: "AI Implementation Prompt",
      content: `# AI Implementation Prompt

Build the following goal with production-quality implementation.

## Goal
${state.rawIntent || state.title}

## Required Features
${list(state.mustHaveFeatures)}

## Constraints
${list(state.constraints)}

## Decisions Already Made
${list(state.decisions)}

## Open Questions
${list(state.unknowns)}
`,
    },
  ];
}
