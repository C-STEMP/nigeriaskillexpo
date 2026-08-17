import { prisma } from "@/lib/prisma";
import { LockState } from "@prisma/client";

export async function isCriterionLocked(
  criterionId: string,
  level: "State" | "Zonal" | "National"
): Promise<{ locked: boolean; reason?: string }> {
  const criterion = await prisma.criterion.findUnique({ where: { id: criterionId } });
  if (!criterion) return { locked: true, reason: "Criterion not found." };

  if (criterion.level === "State_Only" && level !== "State")
    return { locked: true, reason: "This criterion is state-stage only." };
  if (criterion.level === "Zonal_Only" && level !== "Zonal")
    return { locked: true, reason: "This criterion is zonal-stage only." };
  if (criterion.level === "National_Only" && level !== "National")
    return { locked: true, reason: "This criterion is national-stage only." };

  const sectorScopeKey = criterion.sectorId ?? "ALL_SECTORS";
  const [sectorLock, wholeLevelLock] = await Promise.all([
    criterion.sectorId
      ? prisma.criterionLock.findUnique({
          where: { cycleId_level_sectorScopeKey: { cycleId: criterion.cycleId, level, sectorScopeKey } },
        })
      : null,
    prisma.criterionLock.findUnique({
      where: { cycleId_level_sectorScopeKey: { cycleId: criterion.cycleId, level, sectorScopeKey: "ALL_SECTORS" } },
    }),
  ]);

  if (wholeLevelLock?.state === LockState.Locked)
    return { locked: true, reason: `${level} scoring is locked for this competition cycle.` };
  if (sectorLock?.state === LockState.Locked)
    return { locked: true, reason: `${level} scoring is locked for this criterion's sector.` };
  if (criterion.status !== "Active")
    return { locked: true, reason: "This criterion is not currently active." };

  return { locked: false };
}
