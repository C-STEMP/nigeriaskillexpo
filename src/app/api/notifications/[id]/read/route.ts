import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  // Scope the update to the current user — a recipient can only mark
  // their OWN notifications read, never someone else's by guessing an id.
  const result = await prisma.notification.updateMany({
    where: { id, recipientId: session.user.id },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
