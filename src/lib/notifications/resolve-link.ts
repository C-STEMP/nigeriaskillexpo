import { NotificationLinkType } from "@prisma/client";

/**
 * Maps a notification's deep-link fields to a real route in the app.
 * Keeps route structure changes contained to this one file rather than
 * scattered across every place a notification might be rendered.
 */
export function resolveNotificationLink(
  linkType: NotificationLinkType | null,
  linkId: string | null
): string | null {
  if (!linkType || !linkId) return null;

  switch (linkType) {
    // No notification currently produces Panel_Assignment (see
    // notifications.ts — panel-related notifications link to
    // State_Trade_Entry instead, since that's the real scoring route).
    // Routed here too as a safe fallback rather than a 404, in case any
    // historical notification row still has this link type.
    case NotificationLinkType.Panel_Assignment:
      return `/dashboard/entries/${linkId}`;
    case NotificationLinkType.State_Trade_Entry:
      return `/dashboard/entries/${linkId}`;
    case NotificationLinkType.Moderation_Case:
      return `/dashboard/moderation/${linkId}`;
    case NotificationLinkType.Sector_Result:
      return `/dashboard/results/${linkId}`;
    case NotificationLinkType.Award_Result:
      return `/results/awards/${linkId}`;
    case NotificationLinkType.Staff_Registration:
      return `/dashboard/zonal-admin/pending-staff/${linkId}`;
    case NotificationLinkType.Role_Change:
      return `/dashboard/profile/roles`;
    case NotificationLinkType.Criterion_Lock:
      return `/dashboard/admin/criteria/${linkId}`;
    default:
      return null;
  }
}
