import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { updateSectorSchema } from "@/lib/validation/admin";
import { AuditAction } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("edit");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSectorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sector = await prisma.sector.findUnique({ where: { id } });
  if (!sector) {
    return NextResponse.json({ error: "Sector not found." }, { status: 404 });
  }

  const wasDisabled = sector.disabled;

  const updated = await prisma.sector.update({
    where: { id },
    data: {
      name: parsed.data.name,
      disabled: parsed.data.disabled,
      ...(parsed.data.applicableCategories
        ? {
            applicableCategories: {
              deleteMany: {},
              create: parsed.data.applicableCategories.map((category) => ({ category })),
            },
          }
        : {}),
    },
    include: { applicableCategories: true },
  });

  // Audit the specific act of suspending/re-enabling a sector for
  // competition, since that has real consequences for ongoing assessment.
  if (typeof parsed.data.disabled === "boolean" && parsed.data.disabled !== wasDisabled) {
    await prisma.auditLog.create({
      data: {
        actorId: guard.userId,
        action: parsed.data.disabled ? AuditAction.SECTOR_DISABLED : AuditAction.SECTOR_ENABLED,
        metadata: JSON.stringify({ sectorId: id, sectorName: sector.name }),
      },
    });
  }

  return NextResponse.json({ sector: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("delete");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const sector = await prisma.sector.findUnique({
    where: { id },
    include: { _count: { select: { trades: true, criteria: true } } },
  });
  if (!sector) {
    return NextResponse.json({ error: "Sector not found." }, { status: 404 });
  }

  // Never hard-delete a sector that has real data hanging off it — use
  // `disabled` instead, to preserve historical integrity for past cycles.
  if (sector._count.trades > 0 || sector._count.criteria > 0) {
    return NextResponse.json(
      {
        error:
          "This sector has trades or criteria attached and cannot be deleted. Disable it instead to remove it from future competitions while preserving history.",
      },
      { status: 409 }
    );
  }

  await prisma.sector.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
