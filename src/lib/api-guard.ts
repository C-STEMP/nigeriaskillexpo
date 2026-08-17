import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveRoles, hasCapability, type ActiveRole } from "@/lib/permissions";

export type GuardResult =
  | { ok: true; userId: string; roles: ActiveRole[] }
  | { ok: false; response: NextResponse };

/**
 * Loads the session and the user's active roles, and optionally checks a
 * capability. Routes call this once at the top and early-return on
 * `!result.ok`, instead of re-deriving session/roles by hand each time.
 *
 * Usage:
 *   const guard = await requireCapability("edit");
 *   if (!guard.ok) return guard.response;
 *   // guard.userId, guard.roles now available
 */
export async function requireAuth(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  const roles = await getActiveRoles(session.user.id);
  return { ok: true, userId: session.user.id, roles };
}

export async function requireCapability(
  capability: "create" | "edit" | "delete"
): Promise<GuardResult> {
  const result = await requireAuth();
  if (!result.ok) return result;

  if (!hasCapability(result.roles, capability)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 }
      ),
    };
  }
  return result;
}

/** Restricts to a specific set of role names (e.g. only Super_Admin can reset codes). */
export async function requireRole(...roleNames: string[]): Promise<GuardResult> {
  const result = await requireAuth();
  if (!result.ok) return result;

  const hasRequiredRole = result.roles.some((r) => roleNames.includes(r.roleName));
  if (!hasRequiredRole) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You do not have the required role for this action." },
        { status: 403 }
      ),
    };
  }
  return result;
}
