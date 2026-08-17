import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-guard";
import { AuditAction } from "@prisma/client";
import { z } from "zod";
import { notifyPromotion } from "@/server/services/notifications";

const assignAwardSchema = z.object({
  cycleId: z.string().cuid(),
  sectorResultId: z.string().cuid(),
});

/**
 * Manually maps a national-stage SectorResult to an AwardCategory. Per
 * your explicit instruction, NOT every award category will be decided on
 * the platform — only if the composing entity type actually has data
 * here. This route enforces that by checking whether applicants of the
 * category's requiredEntityType actually exist for this cycle/sector
 * before allowing the assignment; Cross_Category skips this check since
 * it's inherently a judgment call combining multiple entity types.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("Super_Admin", "National_Admin");
  if (!guard.ok) return guard.response;
  const { id: awardCategoryId } = await params;

  const body = await req.json();
  const parsed = assignAwardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { cycleId, sectorResultId } = parsed.data;

  const category = await prisma.awardCategory.findUnique({ where: { id: awardCategoryId } });
  if (!category) {
    return NextResponse.json({ error: "Award category not found." }, { status: 404 });
  }

  const sectorResult = await prisma.sectorResult.findUnique({
    where: { id: sectorResultId },
    include: { sector: true },
  });
  if (!sectorResult || sectorResult.stage !== "National") {
    return NextResponse.json(
      { error: "Award categories can only be assigned to National-stage results." },
      { status: 400 }
    );
  }

  if (category.requiredEntityType !== "Cross_Category") {
    const hasEntityData = await prisma.user.findFirst({
      where: { cycleId, applicantCategory: category.requiredEntityType },
    });
    if (!hasEntityData) {
      return NextResponse.json(
        {
          error: `This award category requires ${category.requiredEntityType.replace(/_/g, " ")} data, which does not exist on the platform for this cycle. This category cannot be decided here.`,
        },
        { status: 409 }
      );
    }
  }

  const existing = await prisma.awardResult.findUnique({
    where: { cycleId_awardCategoryId: { cycleId, awardCategoryId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This award category has already been assigned for this cycle." },
      { status: 409 }
    );
  }

  const awardResult = await prisma.awardResult.create({
    data: { cycleId, awardCategoryId, sectorResultId, assignedById: guard.userId },
  });

  await prisma.auditLog.create({
    data: {
      actorId: guard.userId,
      action: AuditAction.AWARD_RESULT_ASSIGNED,
      metadata: JSON.stringify({ awardCategoryId, sectorResultId, cycleId }),
    },
  });

  await notifyPromotion(sectorResultId);

  return NextResponse.json({ awardResult }, { status: 201 });
}
