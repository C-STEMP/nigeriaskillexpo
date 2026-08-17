import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { z } from "zod";

const updateAwardCategorySchema = z.object({
  name: z.string().min(3).max(255).optional(),
  description: z.string().max(2000).optional(),
  requiredEntityType: z
    .enum(["Trainee", "TSP", "Technical_College", "Instructor", "Industry_Partner", "Cross_Category"])
    .optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("edit");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json();
  const parsed = updateAwardCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const category = await prisma.awardCategory.findUnique({ where: { id } });
  if (!category) {
    return NextResponse.json({ error: "Award category not found." }, { status: 404 });
  }

  const updated = await prisma.awardCategory.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ category: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("delete");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const category = await prisma.awardCategory.findUnique({
    where: { id },
    include: { _count: { select: { results: true } } },
  });
  if (!category) {
    return NextResponse.json({ error: "Award category not found." }, { status: 404 });
  }

  if (category._count.results > 0) {
    return NextResponse.json(
      { error: "This award category has already been assigned to a result and cannot be deleted. Set it inactive instead." },
      { status: 409 }
    );
  }

  await prisma.awardCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
