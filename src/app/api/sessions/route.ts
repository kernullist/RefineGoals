import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createFallbackState, toGoalState } from "@/lib/goal-state";

export async function GET() {
  const sessions = db.listSessions();

  return NextResponse.json({
    sessions: sessions.map((session) => ({
      ...toGoalState(session),
      messages: session.messages,
      attachments: session.attachments,
      documents: session.documents,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    message?: string;
  };
  const state = createFallbackState(body.message || "");

  const session = db.createSession({
    title: state.title || "새 목표",
    rawIntent: state.rawIntent || "",
    domain: state.domain || "unknown",
    targetUsers: state.targetUsers || "",
    constraints: JSON.stringify(state.constraints || []),
    references: JSON.stringify(state.references || []),
    mustHaveFeatures: JSON.stringify(state.mustHaveFeatures || []),
    niceToHaveFeatures: JSON.stringify(state.niceToHaveFeatures || []),
    risks: JSON.stringify(state.risks || []),
    unknowns: JSON.stringify(state.unknowns || []),
    decisions: JSON.stringify(state.decisions || []),
    outputType: state.outputType || "dashboard",
    completenessScore: state.completenessScore || 10,
  });

  return NextResponse.json({
    session: toGoalState(session),
  });
}
