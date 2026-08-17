import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveRoles } from "@/lib/permissions";
import { UserType } from "@prisma/client";

/**
 * Tells the compose UI what this user is actually allowed to do, so it
 * can show the right composer instead of a one-size-fits-all form that
 * would let e.g. a Trainee attempt "broadcast to everyone" only to be
 * rejected server-side. Mirrors the rules in lib/permissions/messaging.ts.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [roles, user] = await Promise.all([
    getActiveRoles(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);

  const canBroadcast = roles.some(
    (r) => r.roleName === UserType.Super_Admin || r.roleName === UserType.National_Admin
  );
  const canZoneBroadcast = roles.some((r) => r.roleName === UserType.Zonal_Admin);

  if (canBroadcast || canZoneBroadcast) {
    return NextResponse.json({
      mode: "broadcast",
      canBroadcastEverywhere: canBroadcast,
    });
  }

  // Everyone else gets a fixed, resolved list of direct contacts —
  // computed here rather than left to the client, so the UI can't be
  // tricked into offering a contact the backend would reject anyway.
  let contacts: { id: string; name: string }[] = [];

  if (user?.applicantCategory) {
    // Applicant: only their own zone's Zonal_Admin(s).
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { state: true },
    });
    if (me?.state) {
      const admins = await prisma.userRole.findMany({
        where: { zoneId: me.state.zoneId, revokedAt: null, role: { name: UserType.Zonal_Admin } },
        include: { user: true },
      });
      contacts = admins.map((a) => ({
        id: a.user.id,
        name: a.user.organizationName ?? `${a.user.firstName} ${a.user.lastName}`,
      }));
    }
  } else if (
    roles.some(
      (r) => r.roleName === UserType.Zonal_Assessor || r.roleName === UserType.Zonal_Moderator
    )
  ) {
    const zoneId = roles.find((r) => r.zoneId)?.zoneId;
    const admins = zoneId
      ? await prisma.userRole.findMany({
          where: { zoneId, revokedAt: null, role: { name: UserType.Zonal_Admin } },
          include: { user: true },
        })
      : [];
    contacts = admins.map((a) => ({
      id: a.user.id,
      name: a.user.organizationName ?? `${a.user.firstName} ${a.user.lastName}`,
    }));
  } else if (
    roles.some(
      (r) =>
        r.roleName === UserType.National_Assessor || r.roleName === UserType.National_Moderator
    )
  ) {
    const admins = await prisma.userRole.findMany({
      where: { revokedAt: null, role: { name: UserType.National_Admin } },
      include: { user: true },
    });
    contacts = admins.map((a) => ({
      id: a.user.id,
      name: a.user.organizationName ?? `${a.user.firstName} ${a.user.lastName}`,
    }));
  }

  return NextResponse.json({ mode: "direct", contacts });
}
