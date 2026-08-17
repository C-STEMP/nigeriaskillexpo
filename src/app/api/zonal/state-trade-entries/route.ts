import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { canActOnZone, isOverallAdmin } from "@/lib/permissions";
import { createStateTradeEntrySchema } from "@/lib/validation/assessment";

const MAX_TRADES_PER_SECTOR_PER_STATE = 3;

export async function GET(req: NextRequest) {
  const cycleId = req.nextUrl.searchParams.get("cycleId");
  const sectorId = req.nextUrl.searchParams.get("sectorId");
  const stateId = req.nextUrl.searchParams.get("stateId");
  const zoneId = req.nextUrl.searchParams.get("zoneId");
  const needsPanel = req.nextUrl.searchParams.get("needsPanel") === "true";

  const entries = await prisma.stateTradeEntry.findMany({
    where: {
      cycleId: cycleId ?? undefined,
      sectorId: sectorId ?? undefined,
      stateId: stateId ?? undefined,
      state: zoneId ? { zoneId } : undefined,
    },
    include: {
      sector: true,
      trade: true,
      state: { include: { zone: true } },
      applicant: true,
      panel: { include: { assessor: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // needsPanel is filtered here in application code rather than in the
  // Prisma query itself: Prisma can't express "no panel row where
  // level equals THIS SAME row's currentLevel" as a relation filter,
  // since that would require comparing against a sibling scalar field.
  // An entry "needs a panel" if it has no panel rows AT ITS CURRENT
  // STAGE — it may well have a completed panel from an earlier stage
  // (e.g. State), which does NOT mean it's covered for its current one.
  //
  // Separately: every entry's `panel` array is trimmed here to ONLY its
  // current-level rows before returning to the client. Without this, an
  // entry that's been promoted through multiple stages would return
  // panel rows from EVERY stage combined (e.g. 3 completed State rows +
  // 3 new Zonal rows = 6 total) — the dashboard's "X/3 done" displays
  // assume exactly one stage's worth of rows, so this keeps that
  // assumption true rather than requiring every UI file to re-filter it.
  const withCurrentLevelPanelOnly = entries.map((e) => ({
    ...e,
    panel: e.panel.filter((p) => p.level === e.currentLevel),
  }));

  const filtered = needsPanel
    ? withCurrentLevelPanelOnly.filter((e) => e.panel.length === 0)
    : withCurrentLevelPanelOnly;

  return NextResponse.json({ entries: filtered });
}

/**
 * Creates a StateTradeEntry — ONE APPLICANT's scored performance in a
 * trade, representing a sector, in a state. Multiple applicants CAN be
 * registered under the same trade+state (e.g. 5 trainees doing
 * Bricklaying in Lagos) — each gets their own entry.
 *
 * THE RULE THAT STILL APPLIES: exactly 3 DISTINCT TRADES may represent a
 * sector for a given state — WHICH 3 trades is decided OFFLINE. This is
 * now enforced by counting distinct tradeId values already registered
 * for this (cycle, sector, state), NOT by counting entries — since an
 * entry no longer means "one trade slot", it means "one applicant".
 * Adding a 2nd, 3rd, Nth applicant to an ALREADY-representing trade is
 * always allowed; only a 4th DIFFERENT trade is rejected.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCapability("create");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = createStateTradeEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const state = await prisma.state.findUnique({ where: { id: data.stateId } });
  if (!state) {
    return NextResponse.json({ error: "State not found." }, { status: 404 });
  }

  if (!isOverallAdmin(guard.roles) && !canActOnZone(guard.roles, state.zoneId)) {
    return NextResponse.json(
      { error: "You do not have authority over this state's zone." },
      { status: 403 }
    );
  }

  const trade = await prisma.trade.findUnique({ where: { id: data.tradeId } });
  if (!trade || trade.sectorId !== data.sectorId) {
    return NextResponse.json(
      { error: "Trade not found, or does not belong to the specified sector." },
      { status: 400 }
    );
  }

  const sector = await prisma.sector.findUnique({ where: { id: data.sectorId } });
  if (!sector || sector.disabled) {
    return NextResponse.json(
      { error: "This sector is disabled and not currently open for competition." },
      { status: 400 }
    );
  }

  // The applicant must be a real registrant, registered for THIS cycle,
  // and (if the applicant category requires a trade — Trainee/Instructor)
  // must be registered under the EXACT trade this entry is for. This
  // stops an assessor from accidentally scoring the wrong person under
  // the wrong trade.
  const applicant = await prisma.user.findUnique({ where: { id: data.applicantId } });
  if (!applicant || !applicant.applicantCategory) {
    return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
  }
  if (applicant.cycleId !== data.cycleId) {
    return NextResponse.json(
      { error: "This applicant is not registered for the selected competition cycle." },
      { status: 400 }
    );
  }
  if (applicant.tradeId && applicant.tradeId !== data.tradeId) {
    return NextResponse.json(
      { error: "This applicant is registered under a different trade than the one selected." },
      { status: 400 }
    );
  }

  // THE CORE RULE: exactly 3 DISTINCT TRADES per (cycle, sector, state).
  const existingEntries = await prisma.stateTradeEntry.findMany({
    where: { cycleId: data.cycleId, sectorId: data.sectorId, stateId: data.stateId },
    select: { tradeId: true },
  });
  const distinctTradeIds = new Set(existingEntries.map((e) => e.tradeId));
  const isNewTrade = !distinctTradeIds.has(data.tradeId);
  if (isNewTrade && distinctTradeIds.size >= MAX_TRADES_PER_SECTOR_PER_STATE) {
    return NextResponse.json(
      {
        error: `${state.name} already has ${MAX_TRADES_PER_SECTOR_PER_STATE} distinct trades representing ${sector.name} (this new trade would be a 4th). A sector must be represented by exactly ${MAX_TRADES_PER_SECTOR_PER_STATE} trades.`,
      },
      { status: 409 }
    );
  }

  // Prevent the SAME applicant being entered twice under the same trade+state.
  const duplicate = await prisma.stateTradeEntry.findUnique({
    where: {
      cycleId_sectorId_stateId_tradeId_applicantId: {
        cycleId: data.cycleId,
        sectorId: data.sectorId,
        stateId: data.stateId,
        tradeId: data.tradeId,
        applicantId: data.applicantId,
      },
    },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "This applicant already has an entry for this trade and state." },
      { status: 409 }
    );
  }

  const entry = await prisma.stateTradeEntry.create({
    data,
    include: { sector: true, trade: true, state: true, applicant: true },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
