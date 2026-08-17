import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveRoles } from "@/lib/permissions";
import { replyMessageSchema } from "@/lib/validation/messaging";
import { replyToConversation } from "@/server/services/messaging";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const body = await req.json();
  const parsed = replyMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const roles = await getActiveRoles(session.user.id);

  try {
    const result = await replyToConversation(
      session.user.id,
      roles,
      id,
      parsed.data.body
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send reply.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
