import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-guard";
import { createRegistrationCodeSchema } from "@/lib/validation/admin";

export async function GET() {
  const guard = await requireRole("Super_Admin");
  if (!guard.ok) return guard.response;

  const codes = await prisma.registrationCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { registrants: true } } },
  });
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole("Super_Admin");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = createRegistrationCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.registrationCode.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing) {
    return NextResponse.json({ error: "This code is already in use." }, { status: 409 });
  }

  const code = await prisma.registrationCode.create({ data: { code: parsed.data.code } });
  return NextResponse.json({ code }, { status: 201 });
}
