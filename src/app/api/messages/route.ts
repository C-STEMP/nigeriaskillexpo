import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveRoles } from "@/lib/permissions";
import { MessagingPermissionError } from "@/lib/permissions/messaging";
import {
  sendDirectMessageSchema,
  sendBroadcastMessageSchema,
} from "@/lib/validation/messaging";
import {
  sendDirectMessage,
  sendBroadcastMessage,
} from "@/server/services/messaging";

/** Lists the current user's conversations, most recently active first. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      participants: { include: { user: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ conversations });
}

/**
 * Creates a new message. Payload shape determines direct vs broadcast:
 *   { recipientId, body, subject? }                -> direct
 *   { target: { type, role?, zoneId? }, body, subject? } -> broadcast
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const roles = await getActiveRoles(session.user.id);

  try {
    if ("recipientId" in body) {
      const parsed = sendDirectMessageSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const result = await sendDirectMessage(
        session.user.id,
        roles,
        parsed.data.recipientId,
        parsed.data.body,
        parsed.data.subject
      );
      return NextResponse.json(result, { status: 201 });
    }

    if ("target" in body) {
      const parsed = sendBroadcastMessageSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const result = await sendBroadcastMessage(
        session.user.id,
        roles,
        parsed.data.body,
        parsed.data.target,
        parsed.data.subject
      );
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json(
      { error: "Payload must include either recipientId or target." },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof MessagingPermissionError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
