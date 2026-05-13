import { NextResponse } from "next/server";
import { rm } from "fs/promises";
import path from "path";
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const deleted = db.deleteSession(sessionId);

  if (!deleted) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  try {
    const uploadFolder = path.join(process.cwd(), "uploads", sessionId);
    await rm(uploadFolder, {
      force: true,
      recursive: true,
    });
  } catch (error) {
    console.error("Failed to clean up session uploads.", error);
  }

  return NextResponse.json({
    ok: true,
  });
}
