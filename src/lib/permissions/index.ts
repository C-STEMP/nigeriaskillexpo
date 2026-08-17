import { prisma } from "@/lib/prisma";
import { RoleScope, UserType } from "@prisma/client";

export type ActiveRole = {
  userId: string;
  roleName: UserType;
  scope: RoleScope;
  zoneId: string | null;
  stateId: string | null;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export async function getActiveRoles(userId: string): Promise<ActiveRole[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId, revokedAt: null },
    include: { role: true },
  });
  return userRoles.map((ur) => ({
    userId,
    roleName: ur.role.name,
    scope: ur.role.scope,
    zoneId: ur.zoneId,
    stateId: ur.stateId,
    canCreate: ur.role.canCreate,
    canEdit: ur.role.canEdit,
    canDelete: ur.role.canDelete,
  }));
}

export function hasCapability(roles: ActiveRole[], capability: "create" | "edit" | "delete"): boolean {
  return roles.some((r) =>
    capability === "create" ? r.canCreate : capability === "edit" ? r.canEdit : r.canDelete
  );
}

export function hasRole(roles: ActiveRole[], roleName: UserType): boolean {
  return roles.some((r) => r.roleName === roleName);
}

export function canActOnZone(roles: ActiveRole[], zoneId: string): boolean {
  return roles.some((r) => {
    if (r.scope === RoleScope.National || r.scope === RoleScope.Overall) return true;
    return (r.scope === RoleScope.Zonal || r.scope === RoleScope.State) && r.zoneId === zoneId;
  });
}

export function canActOnState(roles: ActiveRole[], stateId: string, zoneId: string): boolean {
  return roles.some((r) => {
    if (r.scope === RoleScope.National || r.scope === RoleScope.Overall) return true;
    if (r.scope === RoleScope.Zonal && r.zoneId === zoneId) return true;
    return r.scope === RoleScope.State && r.stateId === stateId;
  });
}

export function isOverallAdmin(roles: ActiveRole[]): boolean {
  return roles.some((r) => r.roleName === UserType.Super_Admin || r.scope === RoleScope.Overall);
}

export function isObserver(roles: ActiveRole[]): boolean {
  return roles.some((r) => r.roleName === UserType.Observer_Admin);
}

export class PermissionError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "PermissionError";
  }
}

export function assertCapability(roles: ActiveRole[], capability: "create" | "edit" | "delete") {
  if (!hasCapability(roles, capability)) throw new PermissionError();
}

export function assertZoneAccess(roles: ActiveRole[], zoneId: string) {
  if (!canActOnZone(roles, zoneId)) throw new PermissionError("You do not have authority over this zone.");
}

export function assertStateAccess(roles: ActiveRole[], stateId: string, zoneId: string) {
  if (!canActOnState(roles, stateId, zoneId)) throw new PermissionError("You do not have authority over this state.");
}
