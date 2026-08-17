import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";
import { canActOnZone, canActOnState, isOverallAdmin } from "@/lib/permissions";
import { grantRole } from "@/server/services/roles";
import { UserType, RoleScope } from "@prisma/client";
import { z } from "zod";

const grantSchema = z.object({
  roleName: z.nativeEnum(UserType),
  scope: z.nativeEnum(RoleScope),
  zoneId: z.string().cuid().optional(),
  stateId: z.string().cuid().optional(),
});

/**
 * Authorization rules per the workflow:
 *   - Super_Admin can grant ANY role.
 *   - Zonal_Admin can grant State_Assessor / State_Moderator (scoped to a
 *     specific state within their zone) and Zonal_Assessor / Zonal_Moderator
 *     (scoped to their whole zone).
 *   - National_Admin can grant National_Assessor / National_Moderator.
 * Nobody can self-grant Super_Admin or National_Admin through this route.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;
  const { userId } = await params;

  const body = await req.json();
  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { roleName, scope, zoneId, stateId } = parsed.data;

  const isSuperAdmin = guard.roles.some((r) => r.roleName === UserType.Super_Admin);
  const isZonalAdmin = guard.roles.some((r) => r.roleName === UserType.Zonal_Admin);
  const isNationalAdmin = guard.roles.some((r) => r.roleName === UserType.National_Admin);

  const stateGrantableRoles: UserType[] = [UserType.State_Assessor, UserType.State_Moderator];
  const zonalGrantableRoles: UserType[] = [UserType.Zonal_Assessor, UserType.Zonal_Moderator];
  const nationalGrantableRoles: UserType[] = [UserType.National_Assessor, UserType.National_Moderator];

  if (!isSuperAdmin) {
    if (isZonalAdmin && stateGrantableRoles.includes(roleName)) {
      if (!stateId) {
        return NextResponse.json({ error: "A state must be specified for this role." }, { status: 400 });
      }
      const state = await prisma.state.findUnique({ where: { id: stateId } });
      if (!state || !canActOnState(guard.roles, stateId, state.zoneId)) {
        return NextResponse.json(
          { error: "You can only appoint state roles within your own zone." },
          { status: 403 }
        );
      }
    } else if (isZonalAdmin && zonalGrantableRoles.includes(roleName)) {
      if (!zoneId || !canActOnZone(guard.roles, zoneId)) {
        return NextResponse.json(
          { error: "You can only appoint roles within your own zone." },
          { status: 403 }
        );
      }
    } else if (isNationalAdmin && nationalGrantableRoles.includes(roleName)) {
      // National admin granting national roles — fine, no zone needed.
    } else {
      return NextResponse.json(
        { error: "You do not have authority to grant this role." },
        { status: 403 }
      );
    }
  }

  if (!isOverallAdmin(guard.roles) && zoneId && !canActOnZone(guard.roles, zoneId)) {
    return NextResponse.json({ error: "You do not have authority over this zone." }, { status: 403 });
  }

  const userRole = await grantRole({ userId, roleName, scope, zoneId, stateId });
  return NextResponse.json({ userRole }, { status: 201 });
}
