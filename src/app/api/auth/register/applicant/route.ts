import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  applicantRegistrationSchema,
  INDIVIDUAL_CATEGORIES,
} from "@/lib/validation/registration";
import { CompetitionCycleStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = applicantRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // 1. The competition cycle must actually be Open for registration.
  // This is what powers the "competition is currently closed" banner —
  // the public form posts here regardless, and the server is the real
  // gatekeeper, not just the UI hiding the form.
  const cycle = await prisma.competitionCycle.findUnique({
    where: { id: data.cycleId },
  });
  if (!cycle || cycle.status !== CompetitionCycleStatus.Open) {
    return NextResponse.json(
      { error: "Registration is currently closed for this competition cycle." },
      { status: 403 }
    );
  }

  // 2. Email must be globally unique — across EVERY category and EVERY
  // staff role, since they all share the same User table. Checking here
  // gives a friendlier error than waiting for the DB unique-constraint
  // error to bubble up.
  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase().trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This email is already registered. Each email can only be used once, across all categories." },
      { status: 409 }
    );
  }

  // 3. If a trade was supplied, confirm it exists, belongs to a sector
  // that's actually enabled for this cycle, and that the sector permits
  // this applicant category (SectorApplicantCategory — empty = all allowed).
  if (data.tradeId) {
    const trade = await prisma.trade.findUnique({
      where: { id: data.tradeId },
      include: {
        sector: {
          include: {
            applicableCategories: true,
            cycleOfferings: { where: { cycleId: data.cycleId } },
          },
        },
      },
    });

    if (!trade || trade.disabled || trade.sector.disabled) {
      return NextResponse.json(
        { error: "The selected trade/skill is not currently available." },
        { status: 400 }
      );
    }

    const offering = trade.sector.cycleOfferings[0];
    if (!offering || !offering.enabled) {
      return NextResponse.json(
        { error: "The selected trade's sector is not enabled for this competition cycle." },
        { status: 400 }
      );
    }

    const allowedCategories = trade.sector.applicableCategories.map(
      (c) => c.category
    );
    if (
      allowedCategories.length > 0 &&
      !allowedCategories.includes(data.applicantCategory)
    ) {
      return NextResponse.json(
        { error: "This trade/skill area is not open to your applicant category." },
        { status: 400 }
      );
    }
  }

  // 4. Confirm the chosen state exists (zone is derived from it, never
  // stored redundantly on User — see schema comment).
  const state = await prisma.state.findUnique({ where: { id: data.stateId } });
  if (!state) {
    return NextResponse.json({ error: "Select a valid state." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const isIndividual = (INDIVIDUAL_CATEGORIES as readonly string[]).includes(
    data.applicantCategory
  );

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase().trim(),
      passwordHash,
      applicantCategory: data.applicantCategory,
      cycleId: data.cycleId,
      stateId: data.stateId,
      country: "Nigeria",
      phone: data.phone,
      address: data.address,
      tradeId: data.tradeId,
      ...(isIndividual
        ? {
            firstName: data.firstName,
            lastName: data.lastName,
            gender: data.gender,
          }
        : {
            organizationName: data.organizationName,
          }),
    },
    select: { id: true, email: true, applicantCategory: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
