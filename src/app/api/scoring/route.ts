import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";
import { submitScoreBatchSchema } from "@/lib/validation/scoring";
import { isCriterionLocked } from "@/lib/scoring/lock-check";
import { notifyScoreSubmitted } from "@/server/services/notifications";
import { recomputeTradeEntryTotal } from "@/server/services/promotion-engine";
import { AuditAction } from "@prisma/client";

/**
 * Submits (or updates) one assessor's full set of scores for a trade
 * entry in a single batch. Batching avoids partial-submission states
 * where some criteria are scored and others aren't yet — the assessor
 * fills in everything in one form, then saves once.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = submitScoreBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { stateTradeEntryId, scores } = parsed.data;

  const entry = await prisma.stateTradeEntry.findUnique({
    where: { id: stateTradeEntryId },
    include: { panel: true, state: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "Trade entry not found." }, { status: 404 });
  }

  // Only an assessor actually assigned to THIS entry's panel, AT THE
  // ENTRY'S CURRENT STAGE, may submit scores for it. A stale panel seat
  // from an earlier stage (e.g. a State Assessor's seat after the entry
  // has been promoted to Zonal) must NOT still grant scoring rights —
  // each stage gets its own fresh panel assignment.
  const myPanelSeat = entry.panel.find(
    (p) => p.assessorId === guard.userId && p.level === entry.currentLevel
  );
  if (!myPanelSeat) {
    return NextResponse.json(
      { error: "You are not assigned to the panel for this entry's current stage." },
      { status: 403 }
    );
  }

  // Determine assessment level from the entry's CURRENT stage — flips to
  // National once this entry's sector total has been promoted past
  // zonal, via the promotion routine (see schema.prisma StateTradeEntry
  // .currentLevel for the full explanation).
  const level = entry.currentLevel;

  // Validate every criterion BEFORE writing anything — partial writes
  // followed by a lock-rejection partway through would leave the
  // assessor's submission in a confusing half-saved state.
  for (const s of scores) {
    const lockCheck = await isCriterionLocked(s.criterionId, level);
    if (lockCheck.locked) {
      return NextResponse.json(
        { error: `Cannot submit score for one or more criteria: ${lockCheck.reason}` },
        { status: 423 } // 423 Locked
      );
    }
    const criterion = await prisma.criterion.findUnique({ where: { id: s.criterionId } });
    if (criterion && s.value > Number(criterion.maxScore)) {
      return NextResponse.json(
        {
          error: `Score for criterion exceeds its maximum of ${criterion.maxScore}.`,
        },
        { status: 400 }
      );
    }
  }

  const now = new Date();

  await prisma.$transaction(
    scores.map((s) =>
      prisma.score.upsert({
        where: {
          stateTradeEntryId_criterionId_assessorId: {
            stateTradeEntryId,
            criterionId: s.criterionId,
            assessorId: guard.userId,
          },
        },
        update: {
          value: s.value,
          comment: s.comment,
          evidenceTypeObserved: s.evidenceTypeObserved,
          evidenceNote: s.evidenceNote,
          evidenceUrl: s.evidenceUrl,
          editedAt: now,
        },
        create: {
          stateTradeEntryId,
          criterionId: s.criterionId,
          assessorId: guard.userId,
          value: s.value,
          comment: s.comment,
          evidenceTypeObserved: s.evidenceTypeObserved,
          evidenceNote: s.evidenceNote,
          evidenceUrl: s.evidenceUrl,
        },
      })
    )
  );

  // Mark this assessor's panel seat as complete, recompute the trade
  // entry's cached total/average from the latest scores, audit the
  // action, then fire notifications (zonal admin always; applicant +
  // admin again if this completes the WHOLE panel — handled inside
  // notifyScoreSubmitted).
  await prisma.tradeEntryPanel.update({
    where: { id: myPanelSeat.id },
    data: { completedAt: now },
  });

  await recomputeTradeEntryTotal(stateTradeEntryId);

  await prisma.auditLog.create({
    data: {
      actorId: guard.userId,
      action: AuditAction.SCORE_SUBMITTED,
      metadata: JSON.stringify({ stateTradeEntryId, criterionCount: scores.length }),
    },
  });

  await notifyScoreSubmitted(stateTradeEntryId, guard.userId);

  return NextResponse.json({ success: true, scoredCriteria: scores.length });
}
