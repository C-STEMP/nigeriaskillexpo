import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CompetitionCycleStatus } from "@prisma/client";

export async function GET() {
  const cycle = await prisma.competitionCycle.findFirst({
    where: { status: CompetitionCycleStatus.Open },
    orderBy: { year: "desc" },
    include: {
      sectorOfferings: {
        where: { enabled: true },
        include: { sector: { include: { applicableCategories: true, trades: true } } },
      },
    },
  });

  if (!cycle) {
    return NextResponse.json({ open: false, cycle: null });
  }

  return NextResponse.json({ open: true, cycle });
}
