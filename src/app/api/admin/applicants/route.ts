import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";
import { isOverallAdmin } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const cycleId = req.nextUrl.searchParams.get("cycleId");
  const category = req.nextUrl.searchParams.get("category");
  const sectorId = req.nextUrl.searchParams.get("sectorId");
  const stateId = req.nextUrl.searchParams.get("stateId");
  const search = req.nextUrl.searchParams.get("search");

  // Zonal_Admin (and anyone without overall reach) is scoped to their own
  // zone's applicants only — they should never browse another zone's
  // registrants just by knowing the URL.
  const myZoneIds = guard.roles.filter((r) => r.zoneId).map((r) => r.zoneId as string);
  const zoneRestriction = isOverallAdmin(guard.roles)
    ? undefined
    : { state: { zoneId: { in: myZoneIds } } };

  const applicants = await prisma.user.findMany({
    where: {
      applicantCategory: category ? (category as never) : { not: null },
      cycleId: cycleId ?? undefined,
      stateId: stateId ?? undefined,
      ...(sectorId ? { trade: { sectorId } } : {}),
      ...(zoneRestriction ?? {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search } },
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { organizationName: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      trade: { include: { sector: true } },
      state: { include: { zone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ applicants });
}
