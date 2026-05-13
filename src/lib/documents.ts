import { GoalState } from "@/lib/goal-state";
import { handoffFileName } from "@/lib/filename";

export type DashboardDocument = {
  kind: string;
  title: string;
  content: string;
};

function list(items: string[]): string {
  if (items.length === 0) {
    return "- Not specified yet; treat as an unresolved requirement.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function numbered(items: string[]): string {
  if (items.length === 0) {
    return "1. Not specified yet; ask for clarification before implementation.";
  }

  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function checkbox(items: string[]): string {
  if (items.length === 0) {
    return "- [ ] Not specified yet; define before implementation.";
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
${state.rawIntent || "Not specified yet; treat as unresolved."}

## Domain
${state.domain}

## Target Users
${state.targetUsers || "Not specified yet; treat as unresolved."}

## Decisions
${list(state.decisions)}

## Open Assumptions
${list(state.unknowns)}

## Success Signal
- A future implementer can describe the target users, core workflow, required outputs, and implementation boundaries without reading the chat history.

## Handoff Readiness
- This document is a product brief, not the full implementation contract.
- Give the full ${handoffFileName(state.title)} file to coding AI agents first.
- Use Technical Spec and AI Implementation Prompt as the core implementation sections inside that bundle.
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
${state.mustHaveFeatures.length === 0 ? "- No must-have features have been confirmed yet; ask for confirmation before implementation." : state.mustHaveFeatures
  .map((item) => `- ${item}: provide a visible workflow or API entry point, persist or derive the required output, expose recoverable failure states, and cover the behavior with realistic test data.`)
  .join("\n")}

## UX Acceptance Criteria
- The primary workflow must be visible without reading onboarding text.
- Dashboard users must be able to scan overall status first, then drill into repository, file, function, issue, and recommendation details.
- Long-running analysis work must show progress, partial status, cancellation or retry affordances, and clear completion/failure states.
- Filters, charts, and drilldowns must stay synchronized so users can understand why a code area was ranked as important.
- Exported reports must preserve enough context for a developer to act without reopening the dashboard.
- The export/dashboard area must explain which artifact is for human review and which Markdown handoff should be given to coding AI agents.

## Non-Goals
- No non-goals have been explicitly decided yet.

## Requirement Traceability Checklist
${checkbox([
  "Every must-have feature has a visible UI entry point or API behavior.",
  "Every generated metric, score, and recommendation can be traced back to source data.",
  "Every open question remains visible until answered or explicitly dismissed.",
  "Every external tool, repository, analysis, and storage failure has a user-visible fallback or error state.",
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
- Web dashboard: on-premises web application with project setup, analysis run monitoring, overview metrics, filters, drilldowns, feedback, and report export.
- Source connector layer: GitHub and GitLab repository discovery, authentication, branch selection, clone/fetch, and commit metadata ingestion.
- Analysis orchestration layer: schedules repository analysis runs, isolates tool execution, tracks progress, captures logs, and supports retry/cancel.
- Analyzer adapter layer: normalizes cppcheck, pylint, bandit, PMD, ESLint, AST parsing, complexity, duplication, dependency, and custom smell outputs.
- Repository intelligence layer: correlates static findings with file/function ownership, commit frequency, commit messages, and change-purpose classification.
- Scoring layer: computes improvement priority from static findings, change history, user ratings, comment sentiment, recency, and configurable weights.
- Storage layer: persists repositories, branches, analysis runs, normalized findings, metrics, feedback, recommendations, and export snapshots.
- Reporting layer: generates dashboard views and downloadable implementation/report artifacts from the latest normalized data.

## Implementation Contract
- Treat confirmed decisions as requirements.
- Treat unknowns as unresolved assumptions that must be surfaced in the UI and documents.
- Do not silently implement a guessed answer for an unknown. Recommend a default and ask for confirmation.
- Preserve the on-premises deployment constraint unless a later decision explicitly requires SaaS/cloud behavior.
- Prefer open-source analyzers and transparent scoring rules before adding proprietary services.
- Keep analyzer adapters replaceable so tool upgrades or language additions do not rewrite the dashboard.
- A coding AI should stop and ask for clarification only when an unresolved item blocks architecture, data contracts, or scoring semantics and no recommended default is reasonable.

## Core Modules
- Project Manager: creates workspaces/projects and binds one or more GitHub/GitLab repositories.
- Repository Connector: handles credentials, branch selection, clone/fetch, commit history ingestion, and repository metadata refresh.
- Analysis Runner: executes static analyzers and AST/metric extraction in isolated jobs with progress and logs.
- Analyzer Adapters: one adapter per tool/language, each converting native output into a normalized finding schema.
- AST And Metric Engine: extracts file/function symbols, complexity, duplication, dependencies, and code ownership hints.
- Commit Intelligence Engine: computes change frequency and classifies commit purpose from commit messages and touched files.
- Scoring Engine: combines findings, complexity, duplication, dependencies, change history, ratings, and comment sentiment into improvement priority.
- Feedback Module: stores 1-5 star ratings and comments for whole analysis results, then feeds aggregate signals back into scoring.
- Dashboard UI: overview cards, trends, filters, drilldowns, inline details, and recommendation queues.
- Report Exporter: exports dashboard snapshots and actionable improvement reports.

## Data Model
- Project: id, name, description, createdAt, updatedAt.
- Repository: id, projectId, provider, remoteUrl, defaultBranch, selectedBranches, languageSummary, lastFetchedAt.
- AnalysisRun: id, projectId, repositoryIds, branchRefs, status, startedAt, finishedAt, progress, logs, toolVersions, errorSummary.
- SourceFile: id, repositoryId, path, language, size, hash, lastCommitSha, ownerHint.
- CodeSymbol: id, fileId, kind, name, location, signature, complexity, dependencyRefs.
- Finding: id, runId, repositoryId, fileId, symbolId, tool, ruleId, severity, category, message, location, fingerprint, rawPayload.
- MetricSnapshot: id, runId, scopeType, scopeId, metricName, value, unit.
- CommitSignal: id, repositoryId, fileId, symbolId, commitSha, author, committedAt, purposeCategory, message, touchedLines.
- Feedback: id, runId, rating, comment, sentimentScore, createdAt.
- Recommendation: id, runId, targetType, targetId, priorityScore, rationale, contributingSignals, status.
- ExportReport: id, runId, title, format, content, createdAt.

## State Transitions
1. Project setup: user creates a project and connects GitHub/GitLab repositories.
2. Branch selection: user selects target branches and time range filters.
3. Analysis run queued: system records an AnalysisRun and schedules repository fetch plus analyzer jobs.
4. Repository ingestion: connector fetches source, commit metadata, and branch refs.
5. Static/AST analysis: adapters execute tools and emit normalized findings, symbols, metrics, and logs.
6. Commit intelligence: system computes change frequency and purpose categories for files/functions.
7. Scoring: system combines static findings, metrics, history, ratings, and comment sentiment into recommendations.
8. Dashboard publication: overview cards, charts, filters, and inline drilldowns refresh from the completed run.
9. Feedback loop: user submits rating/comment; scoring and trend displays update.
10. Export: user downloads a report with findings, rationale, recommendations, and run metadata.

## API Surface
- GET /api/projects, POST /api/projects
- GET /api/projects/:projectId/repositories, POST /api/projects/:projectId/repositories
- GET /api/repositories/:repositoryId/branches
- POST /api/analysis-runs, GET /api/analysis-runs/:runId, POST /api/analysis-runs/:runId/cancel, POST /api/analysis-runs/:runId/retry
- GET /api/analysis-runs/:runId/findings
- GET /api/analysis-runs/:runId/metrics
- GET /api/analysis-runs/:runId/recommendations
- POST /api/analysis-runs/:runId/feedback
- GET /api/analysis-runs/:runId/export

## Primary UX Flow
1. User creates a project and connects GitHub/GitLab repositories.
2. User selects branches and analysis period, with recent 1 month as the default period.
3. User starts analysis and monitors per-repository progress, tool logs, and failures.
4. Dashboard shows overview cards, smell/complexity trends, feedback summaries, and high-priority improvement targets.
5. User filters by repository, language, period, severity, smell type, and priority.
6. User clicks a metric or recommendation to expand inline file/function details and contributing signals.
7. User rates the full analysis result and adds a comment.
8. System recalculates improvement priority and exports an actionable report.

## Error And Fallback Behavior
- Repository authentication or fetch failure: mark the repository failed, keep other repositories running, and expose retry with credential diagnostics.
- Analyzer executable missing or exits non-zero: show tool-specific setup/log output and preserve raw logs for troubleshooting.
- AST parse failure for a file: record a per-file parse error and continue analyzing other files.
- Large repository timeout: checkpoint partial results, show skipped scopes, and recommend narrower branch/period filters.
- ML purpose classifier unavailable: fall back to rule-based commit message categories and label the result as lower confidence.
- Feedback sentiment scoring unavailable: use star rating only and preserve comments for later recomputation.
- Export failure: keep the completed run intact and allow retry without rerunning analysis.

## Goal Clarity Gate
- Implementation-ready: completenessScore is about 85 or higher and remaining unknowns are non-blocking.
- Planning-ready: completenessScore is about 60 to 84; continue asking one high-leverage question or offering a recommended default.
- Not ready: completenessScore is below 60 or target users, core workflow, required outputs, constraints, and success criteria are still unclear.
- A coding AI should be able to implement from the full Handoff Markdown bundle, especially Technical Spec and AI Implementation Prompt, without reading the chat transcript before the goal is treated as clear.
- When implementation-ready, show a ready banner with dashboard inspection, full dashboard HTML export, and an AI-agent Markdown handoff export named from the current session title.

## Security And Privacy Notes
- Repository credentials and access tokens must be encrypted at rest and never exposed to the browser after setup.
- Checked-out source code, analyzer logs, commit messages, and findings may contain sensitive intellectual property.
- Analyzer execution should run with least privilege, bounded CPU/memory/time limits, and isolated working directories.
- Exported reports may include file paths, commit metadata, comments, and code snippets; require explicit download action.
- Tool licenses and transitive dependencies must be reviewed before bundling or redistributing analyzers.

## Implementation Constraints
${list(state.constraints)}

## Product Risks
${list(state.risks)}

## Reference Inputs
${list(state.references)}

## Testing Strategy
- Unit test analyzer output normalization, scoring formulas, filter logic, and commit-purpose classification.
- Integration test GitHub/GitLab repository ingestion with fixture repositories.
- Integration test each analyzer adapter with known vulnerable/smelly sample code.
- API test project setup, repository branch discovery, analysis run lifecycle, findings, feedback, recommendations, and export.
- UI test dashboard filters, inline drilldowns, progress/failure states, feedback submission, and report download.
- Performance test large repository ingestion, incremental reruns, and multi-repository analysis.

## Test Matrix
${checkbox([
  "Connect one GitHub repository and one GitLab repository.",
  "Discover branches and run analysis on a selected branch.",
  "Run C++, Python, Java, and JavaScript analyzer adapters against fixture projects.",
  "Normalize analyzer findings into one shared finding schema.",
  "Compute complexity, duplication, dependency, and change-frequency metrics.",
  "Classify commit purpose with ML path and rule-based fallback.",
  "Filter dashboard by repository, language, and period.",
  "Open inline drilldown from overview metric to file/function details.",
  "Submit 1-5 star rating and comment, then verify scoring updates.",
  "Export an actionable report from a completed analysis run.",
  "Retry a failed repository fetch or analyzer job without losing completed results.",
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
You only have this document or the larger RefineGoals handoff bundle that contains it. Do not assume access to the original conversation. Treat every unresolved or not-specified item as an explicit gap to resolve before implementation. Preserve confirmed decisions and do not silently convert unknowns into requirements.

## Implementation Mission
Build the smallest production-quality version that satisfies the confirmed goal state while keeping unresolved assumptions visible. Prefer a complete, reliable local MVP over a broad but shallow prototype.

## Required Features
${list(state.mustHaveFeatures)}

## Recommended Build Order
${numbered([
  "Resolve blocking open questions or apply documented defaults for large-repository optimization and commit-purpose taxonomy.",
  "Scaffold the on-premises web app, database, background worker, and analyzer execution environment.",
  "Implement project, repository, branch, analysis-run, finding, metric, feedback, recommendation, and export data models.",
  "Build GitHub/GitLab connectors with branch selection, clone/fetch, credential handling, and commit metadata ingestion.",
  "Implement analyzer adapters for the selected languages and normalize all tool outputs into one finding schema.",
  "Implement AST/metric extraction, duplication/dependency analysis, commit-frequency analysis, and purpose classification.",
  "Implement priority scoring from findings, metrics, history, ratings, and comment sentiment.",
  "Build the dashboard overview, filters, charts, inline drilldowns, feedback form, and report export.",
  "Add unit, integration, UI, and performance tests using fixture repositories.",
])}

## Expected Screens Or Views
- Project list and project creation.
- Repository connection/setup with GitHub/GitLab provider, credentials, repository URL, and branch selection.
- Analysis run monitor with per-repository status, logs, retry/cancel, and progress.
- Overview dashboard with metric cards, smell/complexity trends, feedback summary, and top improvement targets.
- Filter sidebar for repository, language, period, severity, smell type, and priority.
- Inline drilldown panel for file/function findings, commit history, contributing signals, and recommendation rationale.
- Feedback form for 1-5 star rating and comments on the complete analysis result.
- Export/report view for completed runs, including a short guide that tells users which export is for human review and which Markdown file should be handed to coding AI agents.

## Suggested File/Module Boundaries
- connectors/: GitHub/GitLab repository access, branch discovery, clone/fetch, and commit metadata ingestion.
- analysis/: analysis run orchestration, job queue, worker lifecycle, cancellation, retry, and logs.
- analyzers/: cppcheck, pylint, bandit, PMD, ESLint, AST, complexity, duplication, and dependency adapters.
- normalization/: common finding, metric, symbol, and commit-signal schemas.
- scoring/: priority score, feedback score, sentiment score, and recommendation rationale.
- storage/: database schema, migrations, repositories, and report snapshots.
- api/: project, repository, branch, analysis-run, finding, metric, feedback, recommendation, and export endpoints.
- ui/: setup forms, run monitor, dashboard filters, charts, drilldowns, feedback, and export controls.

## Data And API Requirements
- Persist repositories, selected branches, analysis runs, tool versions, findings, metrics, feedback, recommendations, and exports.
- Store raw analyzer payloads enough for debugging, but render users through the normalized schema.
- Use stable fingerprints for findings so reruns can track resolved, recurring, and newly introduced issues.
- Keep source code checkout paths and credentials server-side.
- API responses must support pagination/filtering for large repositories and many findings.

## Implementation Rules
- Analyzer adapters must be replaceable and independently testable.
- Run external analyzers in isolated working directories with explicit timeouts and captured stdout/stderr.
- Treat ML commit-purpose classification as pluggable; provide a rule-based fallback until training data and categories are finalized.
- Every score shown in the UI must expose contributing signals so users can understand why a file/function was prioritized.
- Keep user feedback at the analysis-result level unless later requirements introduce finding-level feedback.
- Keep the default smell rules built in; user-defined rules are a later extension.

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
- The primary workflow works end to end from repository connection to completed analysis, dashboard review, feedback, and export.
- At least one fixture repository per supported language can be analyzed successfully.
- Analyzer failures, repository failures, timeouts, and partial results are recoverable and visible.
- Dashboard metrics and recommendation scores are traceable to stored findings, metrics, history, and feedback.
- Generated/exported reports are readable, downloadable, and aligned with the current analysis run.

## Final Implementation Checklist
${checkbox([
  "No required workflow is represented only as temporary stub text.",
  "All analysis runs and findings survive page refresh and server restart.",
  "Repository credentials are protected and never rendered back to the browser.",
  "Each analyzer adapter has fixture-based tests.",
  "Large result sets remain usable through pagination, filtering, or aggregation.",
  "Scores and recommendations show their contributing signals.",
  "Failed repositories or analyzers can be retried without rerunning successful work.",
  "Exported reports can be read independently from the dashboard.",
  "README matches the implemented setup and behavior.",
])}
`,
    },
  ];
}
