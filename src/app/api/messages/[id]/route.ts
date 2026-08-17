import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: { include: { user: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: true } },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const isParticipant = conversation.participants.some(
    (p) => p.userId === session.user.id
  );
  if (!isParticipant) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ conversation });
}
