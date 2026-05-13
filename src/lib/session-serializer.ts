import { db, type FullSession } from "@/lib/db";
import { buildDashboardDocuments } from "@/lib/documents";
import { toGoalState } from "@/lib/goal-state";

export type SerializedFullSession = ReturnType<typeof toGoalState> & {
  messages: FullSession["messages"];
  attachments: FullSession["attachments"];
  documents: FullSession["documents"];
};

function hasMeaningfulGoal(session: FullSession): boolean {
  const state = toGoalState(session);
  const rawIntent = state.rawIntent.trim();
  const hasRealIntent = rawIntent.length > 0 && rawIntent !== "새 목표";
  const hasUserMessage = session.messages.some(
    (message) => message.role === "user" && message.content.trim().length > 0,
  );

  return hasRealIntent || hasUserMessage;
}

export function serializeFullSession(
  session: FullSession,
): SerializedFullSession {
  const shouldBuildDocuments = hasMeaningfulGoal(session);
  let refreshed = session;

  if (shouldBuildDocuments) {
    const state = toGoalState(session);
    buildDashboardDocuments(state).forEach((document) => {
      db.upsertDocument({
        sessionId: session.id,
        kind: document.kind,
        title: document.title,
        content: document.content,
      });
    });
    refreshed = db.getFullSession(session.id);
  }

  return {
    ...toGoalState(refreshed),
    messages: refreshed.messages,
    attachments: refreshed.attachments,
    documents: shouldBuildDocuments ? refreshed.documents : [],
  };
}
