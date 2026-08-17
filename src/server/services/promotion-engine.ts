import { prisma } from "@/lib/prisma";
import { computeTradeTotal, computeSectorTotal } from "@/lib/scoring/aggregation";
import { AssessmentStage, AssessmentLevel } from "@prisma/client";
import { notifyPromotion } from "@/server/services/notifications";

const PROMOTION_COUNT = 3; // top 3 advance at every stage, per the confirmed workflow

/**
 * Recomputes and caches tradeTotal/tradeAverage for ONE StateTradeEntry
 * from its current Score rows. Called after every score submission AND
 * after any moderation override, since either can change the underlying
 * numbers. Idempotent — safe to call repeatedly.
 */
export async function recomputeTradeEntryTotal(stateTradeEntryId: string) {
  const scores = await prisma.score.findMany({
    where: { stateTradeEntryId },
    select: { criterionId: true, value: true },
  });

  const { tradeTotal, tradeAverage } = computeTradeTotal(
    scores.map((s) => ({ criterionId: s.criterionId, value: Number(s.value) }))
  );

  await prisma.stateTradeEntry.update({
    where: { id: stateTradeEntryId },
    data: { tradeTotal, tradeAverage },
  });

  return { tradeTotal, tradeAverage };
}

/**
 * Computes (and upserts) the SectorResult row for one (cycle, sector,
 * state) at the State stage — the state's sector total, formed from
 * summing its exactly-3 trade totals. This is "transparency-visible"
 * data: the full list of states' sector totals within a zone, not just
 * the eventual top 3, is what gets displayed — isPromoted is just a flag
 * on top of a result that's always fully visible.
 */
export async function computeStateSectorResult(
  cycleId: string,
  sectorId: string,
  stateId: string
) {
  const entries = await prisma.stateTradeEntry.findMany({
    where: { cycleId, sectorId, stateId },
    select: { tradeId: true, tradeTotal: true, applicantId: true },
  });

  // Group by trade — multiple applicants can share a trade now, so the
  // trade's contribution to the sector total is its TOP-scoring
  // applicant only, not the sum of everyone registered under it.
  const bestByTrade = new Map<string, number>();
  for (const e of entries) {
    const total = Number(e.tradeTotal ?? 0);
    const current = bestByTrade.get(e.tradeId);
    if (current === undefined || total > current) {
      bestByTrade.set(e.tradeId, total);
    }
  }

  const distinctTradeCount = bestByTrade.size;
  const tradeTotals = Array.from(bestByTrade.values());
  const { sectorTotal, isComplete } = computeSectorTotal(tradeTotals);

  if (!isComplete || distinctTradeCount !== 3) {
    // Not all 3 DISTINCT trades are scored/present yet — don't publish a
    // misleadingly partial sector total as if it were final.
    return null;
  }

  const locationScopeKey = `${stateId}:NONE`;

  const result = await prisma.sectorResult.upsert({
    where: {
      cycleId_sectorId_stage_locationScopeKey: {
        cycleId,
        sectorId,
        stage: AssessmentStage.State,
        locationScopeKey,
      },
    },
    update: { sectorTotal },
    create: {
      cycleId,
      sectorId,
      stage: AssessmentStage.State,
      stateId,
      locationScopeKey,
      sectorTotal,
    },
  });

  return result;
}

/**
 * Recomputes the ZONAL-stage SectorResult for one (cycle, sector, zone)
 * from the CURRENT tradeTotal of its Zonal-level entries — i.e. AFTER
 * Zonal Assessors have submitted their scores. Without this, the zonal
 * SectorResult would remain frozen at whatever the State total was at
 * the moment of promotion, and any Zonal-stage scoring would have no
 * effect on the ranking used for Zonal->National promotion (even though
 * the underlying entry's tradeTotal DOES correctly grow to include the
 * new Zonal-level criterion scores — recomputeTradeEntryTotal sums every
 * Score row for an entry regardless of level).
 *
 * Call this AFTER Zonal Assessors finish scoring, and BEFORE running
 * "Promote Zonal -> National" — otherwise the national comparison would
 * silently be based on stale, pre-zonal-scoring numbers.
 */
export async function computeZonalSectorResult(
  cycleId: string,
  sectorId: string,
  zoneId: string
) {
  const statesInZone = await prisma.state.findMany({ where: { zoneId }, select: { id: true } });
  const entries = await prisma.stateTradeEntry.findMany({
    where: {
      cycleId,
      sectorId,
      currentLevel: AssessmentLevel.Zonal,
      stateId: { in: statesInZone.map((s) => s.id) },
    },
    select: { tradeId: true, tradeTotal: true },
  });

  const bestByTrade = new Map<string, number>();
  for (const e of entries) {
    const total = Number(e.tradeTotal ?? 0);
    const current = bestByTrade.get(e.tradeId);
    if (current === undefined || total > current) {
      bestByTrade.set(e.tradeId, total);
    }
  }

  const distinctTradeCount = bestByTrade.size;
  const tradeTotals = Array.from(bestByTrade.values());
  const { sectorTotal, isComplete } = computeSectorTotal(tradeTotals);

  if (!isComplete || distinctTradeCount !== 3) {
    // Not all 3 trades that were promoted to Zonal have entries here —
    // this shouldn't normally happen (State promotion always carries
    // exactly 3 winning trades forward), but guard against publishing a
    // misleading partial total if it somehow does.
    return null;
  }

  const zonalLocationScopeKey = `NONE:${zoneId}`;
  const result = await prisma.sectorResult.upsert({
    where: {
      cycleId_sectorId_stage_locationScopeKey: {
        cycleId,
        sectorId,
        stage: AssessmentStage.Zonal,
        locationScopeKey: zonalLocationScopeKey,
      },
    },
    update: { sectorTotal },
    create: {
      cycleId,
      sectorId,
      stage: AssessmentStage.Zonal,
      zoneId,
      locationScopeKey: zonalLocationScopeKey,
      sectorTotal,
    },
  });

  return result;
}

/**
 * Promotes State -> Zonal for one (cycle, sector, zone): ranks every
 * state's State-stage SectorResult within that zone, marks the top 3
 * isPromoted, creates Zonal-stage SectorResult rows for them, records a
 * Promotion event for each, AND flips currentLevel -> Zonal for ONLY the
 * top-scoring applicant's entry per trade within each promoted state
 * (not every applicant who ever shared that trade) — unlocking
 * Zonal_Only/Nationwide criteria for Zonal Assessors to re-score just
 * that winning entry. currentLevel flips to National on the SECOND
 * promotion, below.
 */
export async function promoteStateToZonal(
  cycleId: string,
  sectorId: string,
  zoneId: string,
  promotedById: string
) {
  const statesInZone = await prisma.state.findMany({ where: { zoneId } });
  const stateIds = statesInZone.map((s) => s.id);

  const stateResults = await prisma.sectorResult.findMany({
    where: {
      cycleId,
      sectorId,
      stage: AssessmentStage.State,
      stateId: { in: stateIds },
    },
    orderBy: { sectorTotal: "desc" },
  });

  if (stateResults.length === 0) {
    return { promoted: [], allRanked: [] };
  }

  // Rank EVERYONE — full transparency, not just the top 3 — then flag
  // the top 3 as isPromoted. The full ranked list stays visible.
  const ranked = await Promise.all(
    stateResults.map((r, index) =>
      prisma.sectorResult.update({
        where: { id: r.id },
        data: { rank: index + 1, isPromoted: index < PROMOTION_COUNT },
      })
    )
  );

  const promotedOnes = ranked.filter((r) => r.isPromoted);

  for (const result of promotedOnes) {
    const zonalLocationScopeKey = `NONE:${zoneId}`;
    const zonalResult = await prisma.sectorResult.upsert({
      where: {
        cycleId_sectorId_stage_locationScopeKey: {
          cycleId,
          sectorId,
          stage: AssessmentStage.Zonal,
          locationScopeKey: zonalLocationScopeKey,
        },
      },
      update: { sectorTotal: result.sectorTotal },
      create: {
        cycleId,
        sectorId,
        stage: AssessmentStage.Zonal,
        zoneId,
        locationScopeKey: zonalLocationScopeKey,
        sectorTotal: result.sectorTotal,
      },
    });

    // Flip currentLevel -> Zonal ONLY for the top-scoring applicant's
    // entry per trade, within THIS promoted state (not the whole zone —
    // only the state that was actually promoted). Non-winning applicants
    // sharing the same trade (e.g. 2nd/3rd/etc. place trainees) do NOT
    // advance — only the one whose score represents the trade going
    // forward.
    if (result.stateId) {
      const stateEntries = await prisma.stateTradeEntry.findMany({
        where: { cycleId, sectorId, stateId: result.stateId },
        select: { id: true, tradeId: true, tradeTotal: true },
      });
      const bestEntryIdByTrade = new Map<string, { id: string; total: number }>();
      for (const e of stateEntries) {
        const total = Number(e.tradeTotal ?? 0);
        const current = bestEntryIdByTrade.get(e.tradeId);
        if (!current || total > current.total) {
          bestEntryIdByTrade.set(e.tradeId, { id: e.id, total });
        }
      }
      const winningEntryIds = Array.from(bestEntryIdByTrade.values()).map((v) => v.id);
      await prisma.stateTradeEntry.updateMany({
        where: { id: { in: winningEntryIds } },
        data: { currentLevel: AssessmentLevel.Zonal },
      });
    }

    await prisma.promotion.create({
      data: {
        cycleId,
        sectorResultId: result.id,
        fromStage: AssessmentStage.State,
        toStage: AssessmentStage.Zonal,
        promotedById,
      },
    });

    await notifyPromotion(zonalResult.id);
  }

  return { promoted: promotedOnes, allRanked: ranked };
}

/**
 * Promotes Zonal -> National for one (cycle, sector): ranks every zone's
 * Zonal-stage SectorResult nationwide, marks the top 3 isPromoted (top 10
 * also visible via rank), creates National-stage SectorResult rows, and
 * — THIS is the point where the underlying StateTradeEntry rows for the
 * winning zone's states actually flip currentLevel to National, unlocking
 * National_Only/Nationwide criteria for those specific entries.
 */
export async function promoteZonalToNational(
  cycleId: string,
  sectorId: string,
  promotedById: string
) {
  const zonalResults = await prisma.sectorResult.findMany({
    where: { cycleId, sectorId, stage: AssessmentStage.Zonal },
    orderBy: { sectorTotal: "desc" },
  });

  if (zonalResults.length === 0) {
    return { promoted: [], allRanked: [] };
  }

  const ranked = await Promise.all(
    zonalResults.map((r, index) =>
      prisma.sectorResult.update({
        where: { id: r.id },
        data: { rank: index + 1, isPromoted: index < PROMOTION_COUNT },
      })
    )
  );

  const promotedOnes = ranked.filter((r) => r.isPromoted);

  for (const result of promotedOnes) {
    const nationalLocationScopeKey = `NONE:${result.zoneId}`;
    const nationalResult = await prisma.sectorResult.upsert({
      where: {
        cycleId_sectorId_stage_locationScopeKey: {
          cycleId,
          sectorId,
          stage: AssessmentStage.National,
          locationScopeKey: nationalLocationScopeKey,
        },
      },
      update: { sectorTotal: result.sectorTotal },
      create: {
        cycleId,
        sectorId,
        stage: AssessmentStage.National,
        zoneId: result.zoneId,
        locationScopeKey: nationalLocationScopeKey,
        sectorTotal: result.sectorTotal,
      },
    });

    await prisma.promotion.create({
      data: {
        cycleId,
        sectorResultId: result.id,
        fromStage: AssessmentStage.Zonal,
        toStage: AssessmentStage.National,
        promotedById,
      },
    });

    // Flip currentLevel -> National ONLY for the top-scoring applicant's
    // entry per trade, among entries that already reached Zonal level
    // (i.e. already survived the State->Zonal cut). Blindly flipping
    // every entry in every state in the zone would incorrectly advance
    // non-winning applicants now that multiple applicants can share a
    // trade — see the corresponding fix in promoteStateToZonal above.
    //
    // NOTE: this assumes the zonal-stage SectorResult for this zone
    // corresponds to ONE specific promoted state's entries. If your zonal
    // aggregation model changes to combine multiple states per zone, this
    // logic will need revisiting — flag this to your engineer if zonal
    // results ever look like they're only reflecting one state's numbers
    // when multiple states were promoted from the same zone.
    if (result.zoneId) {
      const statesInZone = await prisma.state.findMany({
        where: { zoneId: result.zoneId },
        select: { id: true },
      });
      const zonalEntries = await prisma.stateTradeEntry.findMany({
        where: {
          cycleId,
          sectorId,
          stateId: { in: statesInZone.map((s) => s.id) },
          currentLevel: AssessmentLevel.Zonal,
        },
        select: { id: true, tradeId: true, tradeTotal: true },
      });
      const bestEntryIdByTrade = new Map<string, { id: string; total: number }>();
      for (const e of zonalEntries) {
        const total = Number(e.tradeTotal ?? 0);
        const current = bestEntryIdByTrade.get(e.tradeId);
        if (!current || total > current.total) {
          bestEntryIdByTrade.set(e.tradeId, { id: e.id, total });
        }
      }
      const winningEntryIds = Array.from(bestEntryIdByTrade.values()).map((v) => v.id);
      await prisma.stateTradeEntry.updateMany({
        where: { id: { in: winningEntryIds } },
        data: { currentLevel: AssessmentLevel.National },
      });
    }

    await notifyPromotion(nationalResult.id);
  }

  return { promoted: promotedOnes, allRanked: ranked };
}
