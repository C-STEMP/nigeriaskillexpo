import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-guard";
import { updateCycleSchema } from "@/lib/validation/admin";
import { AuditAction } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("Super_Admin", "National_Admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json();
  const parsed = updateCycleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const cycle = await prisma.competitionCycle.findUnique({ where: { id } });
  if (!cycle) {
    return NextResponse.json({ error: "Competition cycle not found." }, { status: 404 });
  }

  const updated = await prisma.competitionCycle.update({
    where: { id },
    data: {
      title: parsed.data.title,
      status: parsed.data.status,
      registrationOpensAt: parsed.data.registrationOpensAt,
      registrationClosesAt: parsed.data.registrationClosesAt,
      ...(parsed.data.sectorIds
        ? {
            sectorOfferings: {
              deleteMany: {},
              create: parsed.data.sectorIds.map((sectorId) => ({ sectorId, enabled: true })),
            },
          }
        : {}),
    },
    include: { sectorOfferings: { include: { sector: true } } },
  });

  if (parsed.data.status && parsed.data.status !== cycle.status) {
    await prisma.auditLog.create({
      data: {
        actorId: guard.userId,
        action: AuditAction.CYCLE_STATUS_CHANGED,
        metadata: JSON.stringify({ cycleId: id, from: cycle.status, to: parsed.data.status }),
      },
    });
  }

  return NextResponse.json({ cycle: updated });
}
