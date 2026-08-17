import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-guard";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

const resetSchema = z.object({ newCode: z.string().min(4).max(50) });

/**
 * Resets a registration code: retires the old one (kept for audit — past
 * staff registrants remain traceable to the code active when they signed
 * up) and creates a fresh active code in its place.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole("Super_Admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json();
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const oldCode = await prisma.registrationCode.findUnique({ where: { id } });
  if (!oldCode) {
    return NextResponse.json({ error: "Registration code not found." }, { status: 404 });
  }

  const duplicate = await prisma.registrationCode.findUnique({
    where: { code: parsed.data.newCode },
  });
  if (duplicate) {
    return NextResponse.json({ error: "This new code is already in use." }, { status: 409 });
  }

  const [, newCode] = await prisma.$transaction([
    prisma.registrationCode.update({
      where: { id },
      data: { isActive: false, retiredAt: new Date() },
    }),
    prisma.registrationCode.create({
      data: { code: parsed.data.newCode },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorId: guard.userId,
      action: AuditAction.REGISTRATION_CODE_RESET,
      metadata: JSON.stringify({ retiredCodeId: id, newCodeId: newCode.id }),
    },
  });

  return NextResponse.json({ newCode });
}
