import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";
import { canActOnZone, isOverallAdmin } from "@/lib/permissions";
import { revokeRole } from "@/server/services/roles";
import { UserType } from "@prisma/client";

/**
 * Revokes a specific UserRole (soft — sets revokedAt, never deletes, per
 * the audit requirement). Per your explicit instruction: "the super admin
 * can revoke the admin status of any regular admin" — Super_Admin can
 * revoke anything. A Zonal_Admin may only revoke roles within their own
 * zone, and may not revoke another Zonal_Admin's admin status (only
 * Super_Admin/National_Admin can do that) — only assessor/moderator
 * roles they themselves have authority to grant.
 */

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userRoleId: string }> }
) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const { userRoleId } = await params;

  const userRole = await prisma.userRole.findUnique({
    where: { id: userRoleId },
    include: { role: true },
  });
  if (!userRole) {
    return NextResponse.json({ error: "Role grant not found." }, { status: 404 });
  }
  if (userRole.revokedAt) {
    return NextResponse.json({ error: "This role has already been revoked." }, { status: 409 });
  }

  const isSuperAdmin = guard.roles.some((r) => r.roleName === UserType.Super_Admin);

  if (!isSuperAdmin) {
    // Non-super-admins can never revoke another admin's admin status —
    // only assessor/moderator roles, and only within zones they control.
    const roleName = userRole.role.name as UserType
    const isAdminRole = [UserType.Zonal_Admin as string, UserType.National_Admin as string].includes(roleName as string);
    if (isAdminRole) {
      return NextResponse.json(
        { error: "Only a Super Admin can revoke admin status." },
        { status: 403 }
      );
    }
    if (!isOverallAdmin(guard.roles) && (!userRole.zoneId || !canActOnZone(guard.roles, userRole.zoneId))) {
      return NextResponse.json(
        { error: "You do not have authority over this zone." },
        { status: 403 }
      );
    }
  }

  const revoked = await revokeRole(userRoleId);
  return NextResponse.json({ userRole: revoked });
}
