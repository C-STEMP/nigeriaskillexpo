import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-guard";
import { createCycleSchema } from "@/lib/validation/admin";

export async function GET() {
  const cycles = await prisma.competitionCycle.findMany({
    orderBy: { year: "desc" },
    include: { sectorOfferings: { include: { sector: true } } },
  });
  return NextResponse.json({ cycles });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole("Super_Admin");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = createCycleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.competitionCycle.findUnique({
    where: { year: parsed.data.year },
  });
  if (existing) {
    return NextResponse.json(
      { error: `A competition cycle for ${parsed.data.year} already exists.` },
      { status: 409 }
    );
  }

  const cycle = await prisma.competitionCycle.create({
    data: {
      year: parsed.data.year,
      title: parsed.data.title,
      sectorOfferings: {
        create: parsed.data.sectorIds.map((sectorId) => ({ sectorId, enabled: true })),
      },
    },
    include: { sectorOfferings: { include: { sector: true } } },
  });

  return NextResponse.json({ cycle }, { status: 201 });
}
