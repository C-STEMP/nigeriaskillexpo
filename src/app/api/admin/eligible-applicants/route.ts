import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";

/**
 * Lists applicants eligible to be added as a StateTradeEntry for a given
 * (cycle, trade, state) — i.e. registered for this cycle, under this
 * exact trade (for Trainee/Instructor, whose registration requires a
 * trade), in this state, and NOT already entered. Used by the "Add
 * entry" picker so an assessor/admin selects a real, matching person
 * rather than typing a name freeform.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const cycleId = req.nextUrl.searchParams.get("cycleId");
  const tradeId = req.nextUrl.searchParams.get("tradeId");
  const stateId = req.nextUrl.searchParams.get("stateId");

  if (!cycleId || !tradeId || !stateId) {
    return NextResponse.json(
      { error: "cycleId, tradeId, and stateId query params are all required." },
      { status: 400 }
    );
  }

  const alreadyEntered = await prisma.stateTradeEntry.findMany({
    where: { cycleId, tradeId, stateId },
    select: { applicantId: true },
  });
  const alreadyEnteredIds = alreadyEntered.map((e) => e.applicantId);

  const eligible = await prisma.user.findMany({
    where: {
      cycleId,
      stateId,
      tradeId,
      applicantCategory: { not: null },
      id: { notIn: alreadyEnteredIds.length > 0 ? alreadyEnteredIds : undefined },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organizationName: true,
      applicantCategory: true,
    },
  });

  return NextResponse.json({ applicants: eligible });
}
