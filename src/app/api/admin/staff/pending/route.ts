import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";
import { canActOnZone, isOverallAdmin } from "@/lib/permissions";

/**
 * Lists staff registrants (came in via the registration-code page) who
 * have NOT yet been granted any active role — these are the people a
 * Zonal_Admin (for their own intendedZoneId) or Super_Admin/National_Admin
 * (any zone) needs to review and appoint.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const zoneId = req.nextUrl.searchParams.get("zoneId");

  if (zoneId && !isOverallAdmin(guard.roles) && !canActOnZone(guard.roles, zoneId)) {
    return NextResponse.json(
      { error: "You do not have authority over this zone." },
      { status: 403 }
    );
  }

  const pending = await prisma.user.findMany({
    where: {
      usedRegistrationCodeId: { not: null },
      applicantCategory: null,
      roles: { none: { revokedAt: null } },
      intendedZoneId: zoneId ?? undefined,
    },
    include: { intendedZone: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pending });
}
