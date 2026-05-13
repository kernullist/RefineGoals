import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSystemPrompt,
  buildUserPrompt,
  callModel,
  ProviderId,
} from "@/lib/ai";
import { buildDashboardDocuments } from "@/lib/documents";
import { db } from "@/lib/db";
import {
  createFallbackState,
  serializeList,
  toGoalState,
} from "@/lib/goal-state";
import { searchWeb, summarizeSearch } from "@/lib/search";

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1),
  provider: z
    .enum(["openrouter", "deepseek", "lmstudio", "ollama"])
    .default("openrouter"),
  useSearch: z.boolean().default(false),
});

type ModelPayload = {
  assistantMessage?: string;
  goalState?: Record<string, unknown>;
  nextQuestions?: string[];
  suggestedArtifacts?: string[];
};

function parsePayload(content: string): ModelPayload {
  const parsed = JSON.parse(content) as ModelPayload;
  return parsed;
}

function fallbackAssistant(message: string): ModelPayload {
  const state = createFallbackState(message);

  return {
    assistantMessage:
      "지금은 모델 호출 설정이 없어서 로컬 규칙으로 목표 초안을 만들었습니다. API 키나 로컬 LLM을 연결하면 다음 턴부터 더 정교하게 구체화할 수 있습니다.",
    goalState: state as Record<string, unknown>,
    nextQuestions: state.unknowns as string[],
    suggestedArtifacts: [
      "Goal Brief",
      "Requirements",
      "Technical Spec",
      "AI Implementation Prompt",
    ],
  };
}

export async function POST(request: Request) {
  const input = chatSchema.parse(await request.json());
  let session = input.sessionId ? db.getSession(input.sessionId) : null;

  if (!session) {
    const fallback = createFallbackState(input.message);
    session = db.createSession({
      title: fallback.title || "새 목표",
      rawIntent: fallback.rawIntent || "",
      domain: fallback.domain || "unknown",
      targetUsers: fallback.targetUsers || "",
      constraints: JSON.stringify(fallback.constraints || []),
      references: JSON.stringify(fallback.references || []),
      mustHaveFeatures: JSON.stringify(fallback.mustHaveFeatures || []),
      niceToHaveFeatures: JSON.stringify(fallback.niceToHaveFeatures || []),
      risks: JSON.stringify(fallback.risks || []),
      unknowns: JSON.stringify(fallback.unknowns || []),
      decisions: JSON.stringify(fallback.decisions || []),
      outputType: fallback.outputType || "dashboard",
      completenessScore: fallback.completenessScore || 10,
    });
  }

  db.createMessage({
    sessionId: session.id,
    role: "user",
    content: input.message,
  });

  const attachments = db.listAttachments(session.id);
  const currentState = toGoalState(session);
  const searchResults = input.useSearch ? await searchWeb(input.message) : [];
  const searchSummary = summarizeSearch(searchResults);
  const attachmentSummary =
    attachments.length === 0
      ? "No image references attached."
      : attachments
          .map((item) => `${item.fileName} (${item.purpose}) at ${item.path}`)
          .join("\n");

  let payload: ModelPayload;
  let providerUsed: ProviderId | "fallback" = "fallback";

  try {
    const result = await callModel({
      provider: input.provider,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt({
            currentState,
            userMessage: input.message,
            searchSummary,
            attachmentSummary,
          }),
        },
      ],
    });
    payload = parsePayload(result.content);
    providerUsed = result.providerUsed;
  } catch (error) {
    payload = fallbackAssistant(input.message);
    providerUsed = "fallback";
    console.error(error);
  }

  const goalState = payload.goalState || {};
  const updated = db.updateSession(session.id, {
    title: String(goalState.title || session.title),
    rawIntent: String(goalState.rawIntent || session.rawIntent),
    domain: String(goalState.domain || session.domain),
    targetUsers: String(goalState.targetUsers || session.targetUsers),
    constraints: serializeList(goalState.constraints),
    references: serializeList(goalState.references),
    mustHaveFeatures: serializeList(goalState.mustHaveFeatures),
    niceToHaveFeatures: serializeList(goalState.niceToHaveFeatures),
    risks: serializeList(goalState.risks),
    unknowns: serializeList(goalState.unknowns),
    decisions: serializeList(goalState.decisions),
    outputType: String(goalState.outputType || "dashboard"),
    completenessScore: Number(goalState.completenessScore || 10),
  });

  const updatedState = toGoalState(updated);
  const documents = buildDashboardDocuments(updatedState);

  documents.forEach((document) => {
    db.upsertDocument({
      sessionId: session.id,
      kind: document.kind,
      title: document.title,
      content: document.content,
    });
  });

  const assistantMessage =
    payload.assistantMessage ||
    "목표 상태를 업데이트했습니다. 오른쪽 패널에서 결정사항과 빈틈을 확인할 수 있습니다.";

  db.createMessage({
    sessionId: session.id,
    role: "assistant",
    content: assistantMessage,
    metadata: JSON.stringify({
      providerUsed,
      searchResults,
      nextQuestions: payload.nextQuestions || [],
      suggestedArtifacts: payload.suggestedArtifacts || [],
    }),
  });

  const fullSession = db.getFullSession(session.id);

  return NextResponse.json({
    session: {
      ...toGoalState(fullSession),
      messages: fullSession.messages,
      attachments: fullSession.attachments,
      documents: fullSession.documents,
    },
  });
}
