import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { canActOnZone, isOverallAdmin } from "@/lib/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entry = await prisma.stateTradeEntry.findUnique({
    where: { id },
    include: {
      sector: true,
      trade: true,
      state: { include: { zone: true } },
      panel: { include: { assessor: true } },
      scores: { include: { criterion: true, assessor: true } },
    },
  });
  if (!entry) {
    return NextResponse.json({ error: "Trade entry not found." }, { status: 404 });
  }
  // Only the CURRENT stage's panel rows — see the list route for why
  // (an entry promoted through multiple stages accumulates panel rows
  // from each one, and the UI's completion displays assume just one
  // stage's worth at a time). Scores are left untouched — each score is
  // tied to a criterion that already carries its own level, so old
  // scores from an earlier stage remain meaningfully distinct and
  // worth showing in full, unlike panel completion tracking.
  const entryWithCurrentPanel = {
    ...entry,
    panel: entry.panel.filter((p) => p.level === entry.currentLevel),
  };
  return NextResponse.json({ entry: entryWithCurrentPanel });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("delete");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const entry = await prisma.stateTradeEntry.findUnique({
    where: { id },
    include: { state: true, panel: true },
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

  if (entry.panel.length > 0) {
    return NextResponse.json(
      {
        error:
          "This entry already has an assessment panel assigned and cannot be removed. Contact a Super Admin if this was made in error.",
      },
      { status: 409 }
    );
  }

  await prisma.stateTradeEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
