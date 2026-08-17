import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { z } from "zod";

const createAwardCategorySchema = z.object({
  name: z.string().min(3).max(255),
  description: z.string().max(2000).optional(),
  requiredEntityType: z.enum([
    "Trainee",
    "TSP",
    "Technical_College",
    "Instructor",
    "Industry_Partner",
    "Cross_Category",
  ]),
});

export async function GET() {
  const categories = await prisma.awardCategory.findMany({
    orderBy: { name: "asc" },
    include: { results: true },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const guard = await requireCapability("create");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = createAwardCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.awardCategory.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "An award category with this name already exists." }, { status: 409 });
  }

  const category = await prisma.awardCategory.create({ data: parsed.data });
  return NextResponse.json({ category }, { status: 201 });
}
