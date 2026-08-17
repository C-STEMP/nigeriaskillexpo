import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { updateTradeSchema } from "@/lib/validation/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("edit");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json();
  const parsed = updateTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) {
    return NextResponse.json({ error: "Trade not found." }, { status: 404 });
  }

  if (parsed.data.name) {
    const duplicate = await prisma.trade.findUnique({
      where: { sectorId_name: { sectorId: trade.sectorId, name: parsed.data.name } },
    });
    if (duplicate && duplicate.id !== id) {
      return NextResponse.json(
        { error: "A trade with this name already exists under this sector." },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.trade.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ trade: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("delete");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const trade = await prisma.trade.findUnique({
    where: { id },
    include: { _count: { select: { registrants: true, criteria: true, stateTradeEntries: true } } },
  });
  if (!trade) {
    return NextResponse.json({ error: "Trade not found." }, { status: 404 });
  }

  if (trade._count.registrants > 0 || trade._count.criteria > 0 || trade._count.stateTradeEntries > 0) {
    return NextResponse.json(
      {
        error:
          "This trade has registrants, criteria, or entries attached and cannot be deleted. Disable it instead to preserve history.",
      },
      { status: 409 }
    );
  }

  await prisma.trade.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
