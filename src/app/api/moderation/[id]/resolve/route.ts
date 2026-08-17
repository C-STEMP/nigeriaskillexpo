import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";
import { resolveModerationCaseSchema } from "@/lib/validation/moderation";
import { notifyModerationResolved } from "@/server/services/notifications";
import { recomputeTradeEntryTotal } from "@/server/services/promotion-engine";
import { AuditAction, ModerationCaseStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json();
  const parsed = resolveModerationCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { status, resolution, overriddenValue } = parsed.data;

  const modCase = await prisma.moderationCase.findUnique({
    where: { id },
    include: { score: true },
  });
  if (!modCase) {
    return NextResponse.json({ error: "Moderation case not found." }, { status: 404 });
  }
  if (modCase.status.startsWith("Resolved") || modCase.status === ModerationCaseStatus.Dismissed) {
    return NextResponse.json(
      { error: "This moderation case has already been resolved." },
      { status: 409 }
    );
  }

  // Only the assigned moderator (or an admin/super-admin, who can always
  // act) should be able to resolve a case — anyone else is just a
  // bystander to the dispute, not an arbiter of it.
  const isAssignedModerator = modCase.moderatorId === guard.userId;
  const isAdmin = guard.roles.some((r) =>
    ["Super_Admin", "National_Admin", "Zonal_Admin"].includes(r.roleName)
  );
  if (!isAssignedModerator && !isAdmin) {
    return NextResponse.json(
      { error: "Only the assigned moderator or an admin may resolve this case." },
      { status: 403 }
    );
  }

  if (status === "Resolved_Overturned") {
    if (overriddenValue === undefined) {
      return NextResponse.json(
        { error: "An overridden value is required when overturning a score." },
        { status: 400 }
      );
    }
    if (!modCase.scoreId) {
      return NextResponse.json(
        { error: "This case has no associated score to overturn." },
        { status: 400 }
      );
    }

    const criterion = await prisma.criterion.findUnique({
      where: { id: modCase.score!.criterionId },
    });
    if (criterion && overriddenValue > Number(criterion.maxScore)) {
      return NextResponse.json(
        { error: `Overridden value exceeds the criterion's maximum of ${criterion.maxScore}.` },
        { status: 400 }
      );
    }

    // Overturning a score corrects the Score row directly, then
    // recomputes this entry's cached tradeTotal/tradeAverage so the
    // correction is reflected immediately in any SectorResult that gets
    // rolled up from it afterward.
    await prisma.score.update({
      where: { id: modCase.scoreId },
      data: { value: overriddenValue, editedAt: new Date() },
    });
    await recomputeTradeEntryTotal(modCase.score!.stateTradeEntryId);
  }

  const updated = await prisma.moderationCase.update({
    where: { id },
    data: {
      status: status as ModerationCaseStatus,
      resolution,
      moderatorId: modCase.moderatorId ?? guard.userId,
      resolvedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: guard.userId,
      action: AuditAction.MODERATION_RESOLVED,
      metadata: JSON.stringify({ caseId: id, status, overriddenValue }),
    },
  });

  await notifyModerationResolved(id);

  return NextResponse.json({ case: updated });
}
