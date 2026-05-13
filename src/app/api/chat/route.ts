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
import { searchImages, searchWeb, summarizeSearch } from "@/lib/search";
import { serializeFullSession } from "@/lib/session-serializer";

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1),
  provider: z
    .enum(["openrouter", "deepseek", "lmstudio", "ollama"])
    .default("openrouter"),
  useSearch: z.boolean().default(false),
});

function shouldForceSearch(message: string): boolean {
  const normalized = message.toLowerCase();
  const patterns = [
    "추천",
    "제안",
    "골라",
    "골라줘",
    "선택",
    "못 고르",
    "못고르",
    "정해줘",
    "뭐가 좋",
    "어느 게",
    "어떤 게",
    "recommend",
    "suggest",
    "choose",
    "pick",
  ];

  return patterns.some((pattern) => normalized.includes(pattern));
}

type ModelPayload = {
  assistantMessage?: string;
  goalState?: Record<string, unknown>;
  nextQuestions?: string[];
  suggestedChoices?: Array<{
    title?: string;
    description?: string;
    tradeoff?: string;
    reply?: string;
    imageQuery?: string;
    imageUrl?: string;
    imageAlt?: string;
    visualHint?: string;
  }>;
  suggestedArtifacts?: string[];
};

function parsePayload(content: string): ModelPayload {
  try {
    const parsed = JSON.parse(content) as ModelPayload;
    return parsed;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start >= 0 && end > start) {
      const parsed = JSON.parse(content.slice(start, end + 1)) as ModelPayload;
      return parsed;
    }

    return {
      assistantMessage: content,
    };
  }
}

function isEmptyStarterState(currentState: ReturnType<typeof toGoalState>) {
  const rawIntent = currentState.rawIntent.trim();
  return rawIntent === "" || rawIntent === "새 목표";
}

function fallbackAssistant(
  currentState: ReturnType<typeof toGoalState>,
  message: string,
  reason?: string,
): ModelPayload {
  const fallbackState = createFallbackState(message);
  const goalState: Record<string, unknown> = {};
  const shouldSeedState = isEmptyStarterState(currentState);

  if (shouldSeedState) {
    goalState.title = fallbackState.title;
    goalState.rawIntent = fallbackState.rawIntent;
    goalState.domain = fallbackState.domain;
    goalState.targetUsers = fallbackState.targetUsers;
    goalState.outputType = fallbackState.outputType;
    goalState.completenessScore = Math.max(
      currentState.completenessScore,
      fallbackState.completenessScore || currentState.completenessScore,
    );

    if (currentState.unknowns.length === 0 && fallbackState.unknowns?.length) {
      goalState.unknowns = fallbackState.unknowns;
    }

    if (currentState.risks.length === 0 && fallbackState.risks?.length) {
      goalState.risks = fallbackState.risks;
    }
  }

  const suffix = reason ? `\n\n실패 원인: ${reason}` : "";
  const fallbackSummary = shouldSeedState
    ? "로컬 규칙으로 목표 초안을 임시 생성했습니다."
    : "기존 목표 상태를 보존하고 로컬 규칙으로 다음 확인 질문만 제안했습니다.";

  return {
    assistantMessage:
      `모델 응답을 가져오지 못해서 ${fallbackSummary} 제공자, 모델명, 검색 API 응답, 네트워크 상태를 확인해 주세요.${suffix}`,
    goalState,
    nextQuestions:
      currentState.unknowns.length > 0
        ? currentState.unknowns.slice(0, 1)
        : ["목표를 구체화하기 위해 가장 먼저 확정해야 할 기준은 무엇인가요?"],
    suggestedArtifacts: [
      "Goal Brief",
      "Requirements",
      "Technical Spec",
      "AI Implementation Prompt",
    ],
  };
}

function serializeListOrExisting(value: unknown, existing: string): string {
  if (!Array.isArray(value)) {
    return existing;
  }

  return serializeList(value);
}

function stringOrExisting(value: unknown, existing: string): string {
  if (typeof value !== "string") {
    return existing;
  }

  const trimmed = value.trim();
  return trimmed || existing;
}

function scoreOrExisting(value: unknown, existing: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return existing;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

async function enrichChoiceImages(
  choices: NonNullable<ModelPayload["suggestedChoices"]>,
) {
  return Promise.all(
    choices.map(async (choice) => {
      if (choice.imageUrl || !choice.imageQuery) {
        return choice;
      }

      const images = await searchImages(choice.imageQuery);
      const image = images[0];

      return {
        ...choice,
        imageUrl: image?.url,
        imageAlt: image?.description || choice.title,
      };
    }),
  );
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
  const searchForced = !input.useSearch && shouldForceSearch(input.message);
  const searchResults =
    input.useSearch || searchForced ? await searchWeb(input.message) : [];
  const searchSummary = summarizeSearch(searchResults);
  const attachmentSummary =
    attachments.length === 0
      ? "No image references attached."
      : attachments
          .map((item) => `${item.fileName} (${item.purpose}) at ${item.path}`)
          .join("\n");

  let payload: ModelPayload;
  let providerUsed: ProviderId | "fallback" = "fallback";
  let failureReason = "";

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
    const reason = error instanceof Error ? error.message : "Unknown model error";
    failureReason = reason;
    payload = fallbackAssistant(currentState, input.message, reason);
    providerUsed = "fallback";
    console.error(error);
  }

  const goalState = payload.goalState || {};
  const updated = db.updateSession(session.id, {
    title: stringOrExisting(goalState.title, session.title),
    rawIntent: stringOrExisting(goalState.rawIntent, session.rawIntent),
    domain: stringOrExisting(goalState.domain, session.domain),
    targetUsers: stringOrExisting(goalState.targetUsers, session.targetUsers),
    constraints: serializeListOrExisting(goalState.constraints, session.constraints),
    references: serializeListOrExisting(goalState.references, session.references),
    mustHaveFeatures: serializeListOrExisting(
      goalState.mustHaveFeatures,
      session.mustHaveFeatures,
    ),
    niceToHaveFeatures: serializeListOrExisting(
      goalState.niceToHaveFeatures,
      session.niceToHaveFeatures,
    ),
    risks: serializeListOrExisting(goalState.risks, session.risks),
    unknowns: serializeListOrExisting(goalState.unknowns, session.unknowns),
    decisions: serializeListOrExisting(goalState.decisions, session.decisions),
    outputType: stringOrExisting(goalState.outputType, session.outputType),
    completenessScore: scoreOrExisting(
      goalState.completenessScore,
      session.completenessScore,
    ),
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

  const nextQuestions = (payload.nextQuestions || []).slice(0, 1);
  const suggestedChoices = await enrichChoiceImages(
    payload.suggestedChoices || [],
  );
  const assistantMessageBase =
    payload.assistantMessage ||
    "목표 상태를 업데이트했습니다. 오른쪽 패널에서 결정사항과 빈틈을 확인할 수 있습니다.";
  const alreadyHasQuestions =
    assistantMessageBase.includes("질문") || assistantMessageBase.includes("?");
  const assistantMessage =
    nextQuestions.length > 0 &&
    !alreadyHasQuestions &&
    !nextQuestions.some((question) => assistantMessageBase.includes(question))
      ? `${assistantMessageBase}\n\n확인 질문:\n${nextQuestions
          .map((question, index) => `${index + 1}. ${question}`)
          .join("\n")}`
      : assistantMessageBase;

  db.createMessage({
    sessionId: session.id,
    role: "assistant",
    content: assistantMessage,
    metadata: JSON.stringify({
      providerUsed,
      searchResults,
      searchForced,
      retryable: providerUsed === "fallback",
      retryMessage: providerUsed === "fallback" ? input.message : undefined,
      failureReason: failureReason || undefined,
      nextQuestions,
      suggestedChoices,
      suggestedArtifacts: payload.suggestedArtifacts || [],
    }),
  });

  const fullSession = db.getFullSession(session.id);

  return NextResponse.json({
    session: serializeFullSession(fullSession),
  });
}
