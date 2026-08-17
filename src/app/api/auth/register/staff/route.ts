import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { staffRegistrationSchema } from "@/lib/validation/registration";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = staffRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // The registration code is the gate to this entire page — without a
  // valid, currently-active code, nobody completes staff registration,
  // regardless of how they found the unlisted URL.
  const code = await prisma.registrationCode.findUnique({
    where: { code: data.registrationCode.trim() },
  });
  if (!code || !code.isActive) {
    return NextResponse.json(
      { error: "Invalid or expired registration code." },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase().trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This email is already registered." },
      { status: 409 }
    );
  }

  const zone = await prisma.zone.findUnique({ where: { id: data.zoneId } });
  if (!zone) {
    return NextResponse.json({ error: "Select a valid zone." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  // NOTE: No Role/UserRole is created here. Per the workflow, staff who
  // register via the code do not self-select a role — a Zonal_Admin (for
  // assessor/moderator) or Super_Admin (for admin) appoints them
  // afterward. This account exists, but is "unassigned" until then, and
  // should show a "pending appointment" state in the dashboard layer.
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase().trim(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      usedRegistrationCodeId: code.id,
      intendedZoneId: zone.id,
    },
    select: { id: true, email: true, intendedZoneId: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
