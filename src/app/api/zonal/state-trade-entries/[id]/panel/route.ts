import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { canActOnZone, isOverallAdmin } from "@/lib/permissions";
import { assignPanelSchema } from "@/lib/validation/assessment";
import { UserType } from "@prisma/client";
import {
  notifyPanelAssigned,
  notifyApplicantsOfPanelSet,
} from "@/server/services/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("create");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json();
  const parsed = assignPanelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { assessorIds, dueAt } = parsed.data;

  const entry = await prisma.stateTradeEntry.findUnique({
    where: { id },
    include: { state: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "Trade entry not found." }, { status: 404 });
  }

  if (!isOverallAdmin(guard.roles) && !canActOnZone(guard.roles, entry.state.zoneId)) {
    return NextResponse.json(
      { error: "You do not have authority over this state's zone." },
      { status: 403 }
    );
  }

  // Check for an existing panel AT THE CURRENT LEVEL specifically — not
  // "any panel this entry has ever had". An entry legitimately gets a
  // FRESH panel each time it's promoted to a new stage (State assessors,
  // then later Zonal assessors, then later National assessors) — only
  // re-assigning WITHIN the same stage should be blocked.
  const existingPanelAtThisLevel = await prisma.tradeEntryPanel.findFirst({
    where: { stateTradeEntryId: entry.id, level: entry.currentLevel },
  });
  if (existingPanelAtThisLevel) {
    return NextResponse.json(
      {
        error: `A panel has already been assigned to this entry for the ${entry.currentLevel} stage. Remove the existing panel before reassigning.`,
      },
      { status: 409 }
    );
  }

  // Distinct check — assignPanelSchema enforces length 3, but doesn't
  // guarantee the 3 IDs are actually different assessors.
  if (new Set(assessorIds).size !== 3) {
    return NextResponse.json(
      { error: "The 3 panel assignments must be 3 distinct assessors." },
      { status: 400 }
    );
  }

  // Confirm every nominated user actually holds an assessor role valid
  // for THIS entry's CURRENT stage — and ONLY that stage's role type:
  //   - currentLevel=State  -> must be State_Assessor, matching this exact state
  //   - currentLevel=Zonal  -> must be Zonal_Assessor, matching this exact zone
  //   - currentLevel=National -> must be National_Assessor (no zone/state
  //     constraint at all — they're RoleScope.National, always zoneId=null,
  //     so checking them against a zoneId, like a Zonal_Assessor, would
  //     incorrectly reject every National Assessor).
  // Gating strictly by currentLevel (rather than accepting any of the
  // three role types loosely) is what stops a National Assessor from
  // being assignable to a still-State-level entry, or vice versa.
  const roleFilter =
    entry.currentLevel === "State"
      ? { role: { name: UserType.State_Assessor }, stateId: entry.stateId }
      : entry.currentLevel === "Zonal"
      ? { role: { name: UserType.Zonal_Assessor }, zoneId: entry.state.zoneId }
      : { role: { name: UserType.National_Assessor } };

  const validAssessors = await prisma.userRole.findMany({
    where: {
      userId: { in: assessorIds },
      revokedAt: null,
      ...roleFilter,
    },
    select: { userId: true },
  });
  const validIds = new Set(validAssessors.map((v) => v.userId));
  const invalid = assessorIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: `One or more nominated users are not active ${entry.currentLevel}-level assessors valid for this entry, and cannot be assigned.`,
      },
      { status: 400 }
    );
  }

  const panel = await prisma.$transaction(
    assessorIds.map((assessorId) =>
      prisma.tradeEntryPanel.create({
        data: {
          stateTradeEntryId: entry.id,
          assessorId,
          assignedById: guard.userId,
          dueAt,
          level: entry.currentLevel,
        },
      })
    )
  );

  // Notify each assessor individually (with the deadline), then notify
  // the applicant(s) that their panel — and its timeline — has been set.
  for (const p of panel) {
    await notifyPanelAssigned(p.id);
  }
  await notifyApplicantsOfPanelSet(entry.id);

  return NextResponse.json({ panel }, { status: 201 });
}
