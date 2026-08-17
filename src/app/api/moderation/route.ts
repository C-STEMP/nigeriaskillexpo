import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";
import { openModerationCaseSchema } from "@/lib/validation/moderation";
import { notifyModerationOpened } from "@/server/services/notifications";
import { AuditAction, UserType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const status = req.nextUrl.searchParams.get("status");
  const cases = await prisma.moderationCase.findMany({
    where: { status: (status as never) ?? undefined },
    include: {
      score: {
        include: {
          criterion: true,
          assessor: true,
          stateTradeEntry: { include: { trade: true, sector: true, state: true, applicant: true } },
        },
      },
      raisedBy: true,
      moderator: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ cases });
}

/**
 * Opens a moderation case — per the workflow, a moderator is NOT
 * automatically part of the assessment process; they only get involved
 * once an appeal/conflict is raised, which is exactly what this route
 * represents. Auto-assigns to an active moderator in the relevant zone
 * if one exists, leaving it unassigned (Open, no moderatorId) otherwise
 * for a Zonal_Admin to assign manually.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = openModerationCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { scoreId, reason } = parsed.data;

  let moderatorId: string | null = null;

  if (scoreId) {
    const score = await prisma.score.findUnique({
      where: { id: scoreId },
      include: { stateTradeEntry: { include: { state: true } } },
    });
    if (!score) {
      return NextResponse.json({ error: "Score not found." }, { status: 404 });
    }

    const zoneId = score.stateTradeEntry.state.zoneId;
    const availableModerator = await prisma.userRole.findFirst({
      where: {
        zoneId,
        revokedAt: null,
        role: { name: UserType.Zonal_Moderator },
      },
      select: { userId: true },
    });
    moderatorId = availableModerator?.userId ?? null;
  }

  const modCase = await prisma.moderationCase.create({
    data: {
      scoreId,
      raisedById: guard.userId,
      reason,
      moderatorId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: guard.userId,
      action: AuditAction.MODERATION_OPENED,
      metadata: JSON.stringify({ caseId: modCase.id, scoreId }),
    },
  });

  await notifyModerationOpened(modCase.id);

  return NextResponse.json({ case: modCase }, { status: 201 });
}
