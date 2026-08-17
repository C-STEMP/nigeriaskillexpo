import { prisma } from "@/lib/prisma";
import { CompetitionCycleStatus, ModerationCaseStatus } from "@prisma/client";

/**
 * Aggregates everything the Executive Overview dashboard needs in one
 * pass. Kept as plain Prisma counts/groupBys rather than raw SQL so it
 * stays portable — this is not yet optimized for very large datasets,
 * but is correct and a reasonable starting point; revisit with proper
 * caching/materialized views if this becomes a bottleneck at scale.
 */
export async function getExecutiveOverviewData(cycleId?: string) {
  const cycle = cycleId
    ? await prisma.competitionCycle.findUnique({ where: { id: cycleId } })
    : await prisma.competitionCycle.findFirst({
        where: { status: { not: CompetitionCycleStatus.Archived } },
        orderBy: { year: "desc" },
      });

  if (!cycle) {
    return null;
  }

  const [
    totalApplicants,
    applicantsByCategory,
    applicantsBySector,
    statesWithApplicants,
    sectorsInCompetition,
    pendingModerationCases,
    overdueAssignments,
    totalPanelAssignments,
    completedPanelAssignments,
    registrationsByMonth,
  ] = await Promise.all([
    prisma.user.count({ where: { cycleId: cycle.id, applicantCategory: { not: null } } }),
    prisma.user.groupBy({
      by: ["applicantCategory"],
      where: { cycleId: cycle.id, applicantCategory: { not: null } },
      _count: true,
    }),
    prisma.user.groupBy({
      by: ["tradeId"],
      where: { cycleId: cycle.id, tradeId: { not: null } },
      _count: true,
    }),
    // Distinct states that actually have at least one applicant this
    // cycle — used below to derive how many of the 6 zones are "active".
    prisma.user.findMany({
      where: { cycleId: cycle.id, applicantCategory: { not: null }, stateId: { not: null } },
      select: { state: { select: { zoneId: true } } },
      distinct: ["stateId"],
    }),
    prisma.cycleSectorOffering.count({ where: { cycleId: cycle.id, enabled: true } }),
    prisma.moderationCase.count({
      where: {
        status: { in: [ModerationCaseStatus.Open, ModerationCaseStatus.Under_Review] },
        score: { stateTradeEntry: { cycleId: cycle.id } },
      },
    }),
    prisma.tradeEntryPanel.count({
      where: {
        completedAt: null,
        dueAt: { lt: new Date() },
        stateTradeEntry: { cycleId: cycle.id },
      },
    }),
    prisma.tradeEntryPanel.count({
      where: { stateTradeEntry: { cycleId: cycle.id } },
    }),
    prisma.tradeEntryPanel.count({
      where: { stateTradeEntry: { cycleId: cycle.id }, completedAt: { not: null } },
    }),
    prisma.user.groupBy({
      by: ["createdAt"],
      where: { cycleId: cycle.id, applicantCategory: { not: null } },
      _count: true,
    }),
  ]);

  const activeZonesCount = new Set(
    statesWithApplicants.map((s) => s.state?.zoneId).filter(Boolean)
  ).size;

  // Resolve trade -> sector names for the "applicants by sector" bar chart.
  const tradeIds = applicantsBySector.map((r) => r.tradeId).filter(Boolean) as string[];
  const trades = await prisma.trade.findMany({
    where: { id: { in: tradeIds } },
    include: { sector: true },
  });
  const sectorTotals = new Map<string, number>();
  for (const row of applicantsBySector) {
    const trade = trades.find((t) => t.id === row.tradeId);
    if (!trade) continue;
    sectorTotals.set(
      trade.sector.name,
      (sectorTotals.get(trade.sector.name) ?? 0) + row._count
    );
  }

  // Bucket registrations by month for the trend line.
  const monthBuckets = new Map<string, number>();
  for (const row of registrationsByMonth) {
    const key = row.createdAt.toISOString().slice(0, 7); // YYYY-MM
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + row._count);
  }

  const completionPct =
    totalPanelAssignments > 0
      ? Math.round((completedPanelAssignments / totalPanelAssignments) * 100)
      : 0;

  return {
    cycle,
    totalApplicants,
    applicantsByCategory: applicantsByCategory.map((r) => ({
      category: r.applicantCategory,
      count: r._count,
    })),
    sectorBreakdown: Array.from(sectorTotals.entries()).map(([sector, count]) => ({
      sector,
      count,
    })),
    activeZonesCount,
    sectorsInCompetition,
    pendingModerationCases,
    overdueAssignments,
    completionPct,
    registrationTrend: Array.from(monthBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
  };
}
