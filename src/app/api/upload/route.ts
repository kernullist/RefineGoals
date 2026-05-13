import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const formData = await request.formData();
  const sessionId = String(formData.get("sessionId") || "");
  const purpose = String(formData.get("purpose") || "UI/design reference");
  const file = formData.get("file");

  if (!sessionId || !(file instanceof File)) {
    return NextResponse.json(
      { error: "sessionId and file are required." },
      { status: 400 },
    );
  }

  const session = db.getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const folder = path.join(process.cwd(), "uploads", sessionId);
  const diskPath = path.join(folder, `${Date.now()}-${safeName}`);

  await mkdir(folder, {
    recursive: true,
  });
  await writeFile(diskPath, bytes);

  const attachment = db.createAttachment({
    sessionId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    path: diskPath,
    purpose,
  });

  return NextResponse.json({
    attachment,
  });
}
