import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toGoalState } from "@/lib/goal-state";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  let session = null;

  try {
    session = db.getFullSession(sessionId);
  } catch {
    session = null;
  }

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    session: {
      ...toGoalState(session),
      messages: session.messages,
      attachments: session.attachments,
      documents: session.documents,
    },
  });
}
