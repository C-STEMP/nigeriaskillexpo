import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { createCriterionSchema } from "@/lib/validation/admin";

export async function GET(req: NextRequest) {
  const cycleId = req.nextUrl.searchParams.get("cycleId");
  const sectorId = req.nextUrl.searchParams.get("sectorId");
  const tradeId = req.nextUrl.searchParams.get("tradeId");
  const level = req.nextUrl.searchParams.get("level");

  const criteria = await prisma.criterion.findMany({
    where: {
      cycleId: cycleId ?? undefined,
      sectorId: sectorId ?? undefined,
      tradeId: tradeId ?? undefined,
      level: (level as never) ?? undefined,
    },
    include: {
      sector: true,
      trade: true,
      allowedEvidenceTypes: { include: { evidenceType: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ criteria });
}

export async function POST(req: NextRequest) {
  const guard = await requireCapability("create");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = createCriterionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const cycle = await prisma.competitionCycle.findUnique({ where: { id: data.cycleId } });
  if (!cycle) {
    return NextResponse.json({ error: "Competition cycle not found." }, { status: 404 });
  }

  if (data.sectorId) {
    const sector = await prisma.sector.findUnique({ where: { id: data.sectorId } });
    if (!sector) {
      return NextResponse.json({ error: "Sector not found." }, { status: 404 });
    }
  }
  if (data.tradeId) {
    const trade = await prisma.trade.findUnique({ where: { id: data.tradeId } });
    if (!trade || trade.sectorId !== data.sectorId) {
      return NextResponse.json(
        { error: "Trade not found, or does not belong to the specified sector." },
        { status: 400 }
      );
    }
  }

  const evidenceTypeRows = await prisma.evidenceType.findMany({
    where: { name: { in: data.allowedEvidenceTypes } },
  });

  const criterion = await prisma.criterion.create({
    data: {
      cycleId: data.cycleId,
      text: data.text,
      maxScore: data.maxScore,
      scope: data.scope,
      level: data.level,
      sectorId: data.sectorId,
      tradeId: data.tradeId,
      status: "Draft",
      allowedEvidenceTypes: {
        create: evidenceTypeRows.map((et) => ({ evidenceTypeId: et.id })),
      },
    },
    include: { allowedEvidenceTypes: { include: { evidenceType: true } } },
  });

  return NextResponse.json({ criterion }, { status: 201 });
}
