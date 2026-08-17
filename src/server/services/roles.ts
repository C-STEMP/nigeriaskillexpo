import { prisma } from "@/lib/prisma";
import { UserType, RoleScope } from "@prisma/client";
import { notifyRoleChanged } from "./notifications";

/**
 * Grants a role to a user. This is the ONLY place in the app that should
 * create UserRole rows, because of a MySQL-specific gotcha: the
 * @@unique([userId, roleId, zoneId]) constraint on UserRole does NOT
 * de-duplicate rows where zoneId is NULL. For zone-less roles we must
 * check-then-create manually instead of relying on the DB constraint.
 */
export async function grantRole(params: {
  userId: string;
  roleName: UserType;
  scope: RoleScope;
  zoneId?: string | null;
  stateId?: string | null;
}) {
  const { userId, roleName, scope, zoneId = null, stateId = null } = params;

  const role = await prisma.role.findUniqueOrThrow({
    where: { name_scope: { name: roleName, scope } },
  });

  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id, zoneId, stateId, revokedAt: null },
  });
  if (existing) return existing;

  const userRole = await prisma.userRole.create({
    data: { userId, roleId: role.id, zoneId, stateId },
  });

  await notifyRoleChanged(userRole.id, "granted");
  return userRole;
}

export async function revokeRole(userRoleId: string) {
  const userRole = await prisma.userRole.update({
    where: { id: userRoleId },
    data: { revokedAt: new Date() },
  });
  await notifyRoleChanged(userRole.id, "revoked");
  return userRole;
}
