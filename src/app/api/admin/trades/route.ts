import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { createTradeSchema } from "@/lib/validation/admin";

export async function GET(req: NextRequest) {
  const sectorId = req.nextUrl.searchParams.get("sectorId");
  const trades = await prisma.trade.findMany({
    where: sectorId ? { sectorId } : undefined,
    include: { sector: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ trades });
}

export async function POST(req: NextRequest) {
  const guard = await requireCapability("create");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = createTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sector = await prisma.sector.findUnique({ where: { id: parsed.data.sectorId } });
  if (!sector) {
    return NextResponse.json({ error: "Sector not found." }, { status: 404 });
  }

  const existing = await prisma.trade.findUnique({
    where: { sectorId_name: { sectorId: parsed.data.sectorId, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A trade with this name already exists under this sector." },
      { status: 409 }
    );
  }

  const trade = await prisma.trade.create({ data: parsed.data });
  return NextResponse.json({ trade }, { status: 201 });
}
