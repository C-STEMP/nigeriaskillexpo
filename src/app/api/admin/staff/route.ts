import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";
import { isOverallAdmin } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const zoneId = req.nextUrl.searchParams.get("zoneId");

  // Zonal_Admin (not an overall admin) is implicitly scoped to their own
  // zone's roles regardless of query params. State_Assessor/State_Moderator
  // roles also carry zoneId (in addition to stateId), so this filter
  // naturally includes them for the zone's admin too.
  const myZoneIds = guard.roles.filter((r) => r.zoneId).map((r) => r.zoneId as string);
  const effectiveZoneId = isOverallAdmin(guard.roles) ? zoneId ?? undefined : myZoneIds[0];

  const roles = await prisma.userRole.findMany({
    where: {
      revokedAt: null,
      zoneId: effectiveZoneId,
    },
    include: { user: true, role: true, zone: true, state: true },
    orderBy: { grantedAt: "desc" },
  });

  return NextResponse.json({ roles });
}
