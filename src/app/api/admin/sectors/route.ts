import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { createSectorSchema } from "@/lib/validation/admin";

export async function GET() {
  const sectors = await prisma.sector.findMany({
    include: {
      applicableCategories: true,
      _count: { select: { trades: true, criteria: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ sectors });
}

export async function POST(req: NextRequest) {
  const guard = await requireCapability("create");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = createSectorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.sector.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "A sector with this name already exists." }, { status: 409 });
  }

  const sector = await prisma.sector.create({
    data: {
      name: parsed.data.name,
      applicableCategories: {
        create: parsed.data.applicableCategories.map((category) => ({ category })),
      },
    },
    include: { applicableCategories: true },
  });

  return NextResponse.json({ sector }, { status: 201 });
}
