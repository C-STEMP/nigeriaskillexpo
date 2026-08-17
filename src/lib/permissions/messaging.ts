import { prisma } from "@/lib/prisma";
import type { ActiveRole } from "@/lib/permissions";
import { StateTradeEntry, UserType } from "@prisma/client";

/**
 * Messaging reach rules. This is deliberately its OWN module, separate
 * from the general capability/scope permissions in lib/permissions —
 * "can this user message that user" is a more specific, relationship-
 * dependent question than "can this user edit a Score".
 *
 *   Trainee/Applicant       -> their own Zonal_Admin ONLY (not assessors —
 *                              avoids any appearance of influencing scoring)
 *   Zonal_Assessor          -> their Zonal_Admin; applicants on panels
 *                              they're currently assigned to
 *   Zonal_Moderator         -> their Zonal_Admin; applicants tied to cases
 *                              they are moderating
 *   Zonal_Admin             -> everyone below them in their OWN zone
 *                              (assessors, moderators, applicants); the
 *                              National_Admin
 *   National_Assessor/Mod   -> National_Admin ONLY (no applicant contact —
 *                              national entries are zone aggregates, not
 *                              individual people)
 *   National_Admin          -> broadcast to everyone, OR targeted to a
 *                              specific role/zone, OR 1-to-1 to anyone
 *   Super_Admin             -> same full reach as National_Admin
 *   Observer_Admin          -> CANNOT send (read-only role, no canCreate)
 */

export class MessagingPermissionError extends Error {
  constructor(message = "You are not permitted to message this recipient.") {
    super(message);
    this.name = "MessagingPermissionError";
  }
}

/** Resolves a user's "home zone" — the zone of their state (applicants) or their zonal role assignment (staff). */
async function getUserZoneId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { state: true },
  });
  if (user?.state) return user.state.zoneId;

  const zonalRole = await prisma.userRole.findFirst({
    where: { userId, revokedAt: null, zoneId: { not: null } },
  });
  return zonalRole?.zoneId ?? null;
}

/**
 * Checks whether `senderRoles` permits sending a DIRECT message to
 * `recipientId`. Throws MessagingPermissionError if not allowed.
 */
export async function assertCanMessageDirect(
  senderId: string,
  senderRoles: ActiveRole[],
  recipientId: string
) {
  if (senderId === recipientId) {
    throw new MessagingPermissionError("You cannot message yourself.");
  }

  // Observer_Admin can never send — read-only by definition.
  if (senderRoles.some((r) => r.roleName === UserType.Observer_Admin)) {
    throw new MessagingPermissionError("Observer accounts cannot send messages.");
  }

  // Super_Admin / National_Admin: full reach, no further checks needed.
  if (
    senderRoles.some(
      (r) =>
        r.roleName === UserType.Super_Admin || r.roleName === UserType.National_Admin
    )
  ) {
    return;
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    include: { roles: { where: { revokedAt: null }, include: { role: true } } },
  });
  if (!recipient) throw new MessagingPermissionError("Recipient not found.");

  const recipientRoleNames = recipient.roles.map((r) => r.role.name);
  const recipientIsApplicant = Boolean(recipient.applicantCategory);

  const senderZoneId = await getUserZoneId(senderId);

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { applicantCategory: true },
  });
  const senderIsApplicant = Boolean(sender?.applicantCategory);

  // --- Applicant sender: Zonal_Admin of their own zone ONLY ---
  if (senderIsApplicant) {
    const isRecipientMyZonalAdmin =
      recipientRoleNames.includes(UserType.Zonal_Admin) &&
      (await getUserZoneId(recipientId)) === senderZoneId;
    if (!isRecipientMyZonalAdmin) {
      throw new MessagingPermissionError(
        "You can only message your Zonal Admin."
      );
    }
    return;
  }

  // --- State_Assessor / State_Moderator / Zonal_Assessor / Zonal_Moderator ---
  // All four follow the same messaging pattern: message their Zonal_Admin,
  // plus applicants they're actively connected to via a shared panel or a
  // case they're moderating.
  if (
    senderRoles.some(
      (r) =>
        r.roleName === UserType.State_Assessor ||
        r.roleName === UserType.State_Moderator ||
        r.roleName === UserType.Zonal_Assessor ||
        r.roleName === UserType.Zonal_Moderator
    )
  ) {
    // Allowed: their own Zonal_Admin.
    if (
      recipientRoleNames.includes(UserType.Zonal_Admin) &&
      (await getUserZoneId(recipientId)) === senderZoneId
    ) {
      return;
    }
    // Allowed: an applicant they're actively connected to (assessor: on a
    // shared panel; moderator: tied to a case they're moderating).
    if (recipientIsApplicant) {
      const sharedPanel = await prisma.tradeEntryPanel.findFirst({
        where: {
          assessorId: senderId,
          stateTradeEntry: { tradeId: recipient.tradeId ?? undefined, stateId: recipient.stateId ?? undefined },
        },
      });
      if (sharedPanel) return;

      const moderatedCase = await prisma.moderationCase.findFirst({
        where: {
          moderatorId: senderId,
          score: {
            stateTradeEntry: { tradeId: recipient.tradeId ?? undefined, stateId: recipient.stateId ?? undefined },
          },
        },
      });
      if (moderatedCase) return;
    }
    throw new MessagingPermissionError(
      "You can only message your Zonal Admin or applicants you are actively assessing/moderating."
    );
  }

  // --- Zonal_Admin ---
  if (senderRoles.some((r) => r.roleName === UserType.Zonal_Admin)) {
    // Allowed: National_Admin (any).
    if (recipientRoleNames.includes(UserType.National_Admin)) return;
    // Allowed: anyone "below" them in their OWN zone — zonal staff or applicants.
    const recipientZoneId = await getUserZoneId(recipientId);
    if (recipientZoneId === senderZoneId) return;
    throw new MessagingPermissionError(
      "You can only message people within your own zone, or the National Admin."
    );
  }

  // --- National_Assessor / National_Moderator ---
  if (
    senderRoles.some(
      (r) =>
        r.roleName === UserType.National_Assessor ||
        r.roleName === UserType.National_Moderator
    )
  ) {
    if (recipientRoleNames.includes(UserType.National_Admin)) return;
    throw new MessagingPermissionError(
      "National Assessors and Moderators can only message the National Admin."
    );
  }

  throw new MessagingPermissionError();
}

/**
 * For broadcast/targeted messages, only National_Admin and Super_Admin
 * (full reach) and Zonal_Admin (zone-scoped reach) are permitted at all.
 * Returns the resolved list of recipient user IDs for the given target.
 */
export async function resolveBroadcastRecipients(
  senderRoles: ActiveRole[],
  target: {
    type: "Everyone" | "Specific_Role" | "Specific_Zone" | "Specific_Role_In_Zone";
    role?: UserType;
    zoneId?: string;
  }
): Promise<string[]> {
  const isFullReach = senderRoles.some(
    (r) => r.roleName === UserType.Super_Admin || r.roleName === UserType.National_Admin
  );
  const zonalAdminZones = senderRoles
    .filter((r) => r.roleName === UserType.Zonal_Admin && r.zoneId)
    .map((r) => r.zoneId as string);

  if (!isFullReach && zonalAdminZones.length === 0) {
    throw new MessagingPermissionError(
      "Only admins can send targeted or broadcast messages."
    );
  }

  // Zonal_Admin can only target their OWN zone, never "Everyone" or another zone.
  if (!isFullReach) {
    if (target.type === "Everyone") {
      throw new MessagingPermissionError("Zonal Admins cannot broadcast to everyone.");
    }
    if (target.zoneId && !zonalAdminZones.includes(target.zoneId)) {
      throw new MessagingPermissionError("You can only target your own zone.");
    }
  }

  const where: Record<string, unknown> = {};
  if (target.type === "Everyone") {
    // no filter
  } else if (target.type === "Specific_Role") {
    where.roles = { some: { revokedAt: null, role: { name: target.role } } };
  } else if (target.type === "Specific_Zone") {
    where.OR = [
      { state: { zoneId: target.zoneId } },
      { roles: { some: { revokedAt: null, zoneId: target.zoneId } } },
    ];
  } else if (target.type === "Specific_Role_In_Zone") {
    where.roles = {
      some: { revokedAt: null, zoneId: target.zoneId, role: { name: target.role } },
    };
  }

  const recipients = await prisma.user.findMany({ where, select: { id: true } });
  return recipients.map((r) => r.id);
}
