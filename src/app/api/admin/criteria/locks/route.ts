import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-guard";
import { AuditAction, LockState } from "@prisma/client";
import { z } from "zod";

const lockActionSchema = z.object({
  cycleId: z.string().cuid(),
  level: z.enum(["Zonal", "National"]),
  sectorId: z.string().cuid().optional(), // omit to lock/unlock the WHOLE level for this cycle
  action: z.enum(["lock", "unlock"]),
});

/**
 * Locking is restricted to Super_Admin / National_Admin only — this is
 * the anti-cheating control, so it should NOT be something a Zonal_Admin
 * can toggle on their own zone's scoring (that would defeat the purpose).
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole("Super_Admin", "National_Admin");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = lockActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { cycleId, level, sectorId, action } = parsed.data;
  const sectorScopeKey = sectorId ?? "ALL_SECTORS";

  const lock = await prisma.criterionLock.upsert({
    where: {
      cycleId_level_sectorScopeKey: { cycleId, level, sectorScopeKey },
    },
    update: {
      state: action === "lock" ? LockState.Locked : LockState.Open,
      lockedById: action === "lock" ? guard.userId : undefined,
      lockedAt: action === "lock" ? new Date() : undefined,
      unlockedAt: action === "unlock" ? new Date() : undefined,
    },
    create: {
      cycleId,
      level,
      sectorId,
      sectorScopeKey,
      state: action === "lock" ? LockState.Locked : LockState.Open,
      lockedById: action === "lock" ? guard.userId : undefined,
      lockedAt: action === "lock" ? new Date() : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: guard.userId,
      action: action === "lock" ? AuditAction.CRITERION_LOCKED : AuditAction.CRITERION_UNLOCKED,
      metadata: JSON.stringify({ cycleId, level, sectorId: sectorId ?? "ALL_SECTORS" }),
    },
  });

  return NextResponse.json({ lock });
}

export async function GET(req: NextRequest) {
  const cycleId = req.nextUrl.searchParams.get("cycleId");
  if (!cycleId) {
    return NextResponse.json({ error: "cycleId query param is required." }, { status: 400 });
  }
  const locks = await prisma.criterionLock.findMany({
    where: { cycleId },
    include: { sector: true },
  });
  return NextResponse.json({ locks });
}
