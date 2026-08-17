import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { updateCriterionSchema } from "@/lib/validation/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("edit");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json();
  const parsed = updateCriterionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const criterion = await prisma.criterion.findUnique({
    where: { id },
    include: { _count: { select: { scores: true } } },
  });
  if (!criterion) {
    return NextResponse.json({ error: "Criterion not found." }, { status: 404 });
  }

  // Once any score has been recorded against a criterion, its maxScore
  // can no longer change — editing it after scoring has started would
  // silently invalidate averages already computed against the old max.
  if (parsed.data.maxScore !== undefined && criterion._count.scores > 0) {
    return NextResponse.json(
      { error: "This criterion already has scores recorded and its maximum score can no longer be changed." },
      { status: 409 }
    );
  }

  let evidenceTypeUpdate = {};
  if (parsed.data.allowedEvidenceTypes) {
    const evidenceTypeRows = await prisma.evidenceType.findMany({
      where: { name: { in: parsed.data.allowedEvidenceTypes } },
    });
    evidenceTypeUpdate = {
      allowedEvidenceTypes: {
        deleteMany: {},
        create: evidenceTypeRows.map((et) => ({ evidenceTypeId: et.id })),
      },
    };
  }

  const updated = await prisma.criterion.update({
    where: { id },
    data: {
      text: parsed.data.text,
      maxScore: parsed.data.maxScore,
      status: parsed.data.status,
      ...evidenceTypeUpdate,
    },
    include: { allowedEvidenceTypes: { include: { evidenceType: true } } },
  });

  return NextResponse.json({ criterion: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("delete");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const criterion = await prisma.criterion.findUnique({
    where: { id },
    include: { _count: { select: { scores: true } } },
  });
  if (!criterion) {
    return NextResponse.json({ error: "Criterion not found." }, { status: 404 });
  }

  if (criterion._count.scores > 0) {
    return NextResponse.json(
      {
        error:
          "This criterion has scores recorded against it and cannot be deleted. Set its status to Retired instead.",
      },
      { status: 409 }
    );
  }

  await prisma.criterion.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
