import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createFallbackState } from "@/lib/goal-state";
import { serializeFullSession } from "@/lib/session-serializer";

export async function GET() {
  const sessions = db.listSessions();

  return NextResponse.json({
    sessions: sessions.map((session) => serializeFullSession(session)),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
  };
  const message = body.message?.trim() || "";
  const state = message ? createFallbackState(message) : null;

  const session = db.createSession({
    title: state?.title || "새 목표",
    rawIntent: state?.rawIntent || "",
    domain: state?.domain || "unknown",
    targetUsers: state?.targetUsers || "",
    constraints: JSON.stringify(state?.constraints || []),
    references: JSON.stringify(state?.references || []),
    mustHaveFeatures: JSON.stringify(state?.mustHaveFeatures || []),
    niceToHaveFeatures: JSON.stringify(state?.niceToHaveFeatures || []),
    risks: JSON.stringify(state?.risks || []),
    unknowns: JSON.stringify(state?.unknowns || []),
    decisions: JSON.stringify(state?.decisions || []),
    outputType: state?.outputType || "dashboard",
    completenessScore: state?.completenessScore || 0,
  });

  return NextResponse.json({
    session: serializeFullSession(db.getFullSession(session.id)),
  });
}
