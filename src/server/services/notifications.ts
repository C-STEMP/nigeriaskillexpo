import { prisma } from "@/lib/prisma";
import { NotificationLinkType, NotificationType } from "@prisma/client";

/**
 * Central notification dispatch. API routes call these helpers instead of
 * writing to the Notification table directly, so the trigger logic for
 * "who gets told what, linking where" lives in exactly one place.
 *
 * Every notification carries a (linkType, linkId) pair — the frontend's
 * notification bell resolves this into a real route so clicking a
 * notification lands on the exact record, not a generic dashboard page.
 */

async function createNotification(params: {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkType?: NotificationLinkType;
  linkId?: string;
}) {
  return prisma.notification.create({ data: params });
}

async function createMany(
  recipients: string[],
  rest: Omit<Parameters<typeof createNotification>[0], "recipientId">
) {
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map((recipientId) => ({ recipientId, ...rest })),
  });
}

/** Assessor assigned to a panel — notify them immediately, with the deadline. */
export async function notifyPanelAssigned(panelId: string) {
  const panel = await prisma.tradeEntryPanel.findUnique({
    where: { id: panelId },
    include: {
      stateTradeEntry: { include: { trade: true, sector: true, state: true } },
    },
  });
  if (!panel) return;

  const dueDate = panel.dueAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  await createNotification({
    recipientId: panel.assessorId,
    type: NotificationType.PANEL_ASSIGNED,
    title: "You've been assigned to an assessment panel",
    body: `You're on the panel for ${panel.stateTradeEntry.trade.name} (${panel.stateTradeEntry.sector.name}) in ${panel.stateTradeEntry.state.name}. Please complete your scoring by ${dueDate}.`,
    // Linked to the StateTradeEntry, not the TradeEntryPanel — clicking
    // this should take the assessor straight to the scoring form for the
    // entry (/dashboard/entries/{id}), which is what actually exists.
    // There is no standalone "view your panel seat" page.
    linkType: NotificationLinkType.State_Trade_Entry,
    linkId: panel.stateTradeEntryId,
  });
}

/**
 * Notify the relevant Zonal_Admin(s) when an assessor submits a verdict,
 * and notify the applicant once their FULL panel (all 3 assessors) is done.
 */
export async function notifyScoreSubmitted(
  stateTradeEntryId: string,
  assessorId: string
) {
  const entry = await prisma.stateTradeEntry.findUnique({
    where: { id: stateTradeEntryId },
    include: {
      trade: true,
      sector: true,
      state: { include: { zone: true } },
      panel: true,
    },
  });
  if (!entry) return;

  const assessor = await prisma.user.findUnique({ where: { id: assessorId } });
  const assessorName = assessor
    ? assessor.organizationName ?? `${assessor.firstName} ${assessor.lastName}`
    : "An assessor";

  // Find active Zonal_Admins for this entry's zone.
  const zonalAdmins = await prisma.userRole.findMany({
    where: {
      zoneId: entry.state.zoneId,
      revokedAt: null,
      role: { name: "Zonal_Admin" },
    },
    select: { userId: true },
  });

  await createMany(
    zonalAdmins.map((a) => a.userId),
    {
      type: NotificationType.SCORE_SUBMITTED,
      title: "An assessor has submitted a verdict",
      body: `${assessorName} submitted scores for ${entry.trade.name} (${entry.sector.name}) in ${entry.state.name}.`,
      linkType: NotificationLinkType.State_Trade_Entry,
      linkId: entry.id,
    }
  );

  // Check whether all 3 panel members AT THE CURRENT STAGE have now
  // completed their scoring — not every panel row this entry has ever
  // had across its whole lifetime (a completed State-stage panel from
  // an earlier promotion would otherwise mask a still-in-progress Zonal
  // or National panel).
  const currentLevelPanel = await prisma.tradeEntryPanel.findMany({
    where: { stateTradeEntryId: entry.id, level: entry.currentLevel },
  });
  const stillPending = currentLevelPanel.some((p) => !p.completedAt);
  if (stillPending) return;

  // Whole panel done — tell zonal admins (distinct event) and the applicant.
  await createMany(
    zonalAdmins.map((a) => a.userId),
    {
      type: NotificationType.PANEL_COMPLETED,
      title: "Panel assessment complete",
      body: `All 3 assessors have submitted scores for ${entry.trade.name} (${entry.sector.name}) in ${entry.state.name}.`,
      linkType: NotificationLinkType.State_Trade_Entry,
      linkId: entry.id,
    }
  );

  // Notify the specific applicant this entry belongs to — NOT everyone
  // who happens to share the same trade+state (multiple applicants can,
  // now that entries are per-person).
  await createNotification({
    recipientId: entry.applicantId,
    type: NotificationType.PANEL_COMPLETED,
    title: "Your assessment has been completed",
    body: `All assessors have completed scoring for your trade (${entry.trade.name}). Results will be reviewed before moving to the next stage.`,
    linkType: NotificationLinkType.State_Trade_Entry,
    linkId: entry.id,
  });
}

/** Applicant + Zonal_Admin told the time and panel members for their assessment. */
export async function notifyApplicantsOfPanelSet(stateTradeEntryId: string) {
  const entry = await prisma.stateTradeEntry.findUnique({
    where: { id: stateTradeEntryId },
    include: {
      trade: true,
      sector: true,
      state: true,
      panel: { include: { assessor: true } },
    },
  });
  if (!entry) return;

  const panelNames = entry.panel
    .map((p) =>
      p.assessor.organizationName ??
      `${p.assessor.firstName} ${p.assessor.lastName}`
    )
    .join(", ");
  const earliestDue = entry.panel.reduce(
    (min, p) => (p.dueAt < min ? p.dueAt : min),
    entry.panel[0]?.dueAt ?? new Date()
  );
  const dueDate = earliestDue.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  await createNotification({
    recipientId: entry.applicantId,
    type: NotificationType.PANEL_ASSIGNED,
    title: "Your assessment panel has been set",
    body: `Your assessment panel (${panelNames}) has been assigned and is expected to complete review by ${dueDate}.`,
    linkType: NotificationLinkType.State_Trade_Entry,
    linkId: entry.id,
  });
}

/** Overdue panel assignment — notify the assessor AND their Zonal_Admin. */
export async function notifyPanelOverdue(panelId: string) {
  const panel = await prisma.tradeEntryPanel.findUnique({
    where: { id: panelId },
    include: {
      stateTradeEntry: {
        include: { trade: true, sector: true, state: { include: { zone: true } } },
      },
    },
  });
  if (!panel) return;

  await createNotification({
    recipientId: panel.assessorId,
    type: NotificationType.PANEL_ASSIGNMENT_OVERDUE,
    title: "Your assessment is overdue",
    body: `Scoring for ${panel.stateTradeEntry.trade.name} (${panel.stateTradeEntry.sector.name}) in ${panel.stateTradeEntry.state.name} was due on ${panel.dueAt.toLocaleDateString("en-GB")}. Please complete it as soon as possible.`,
    linkType: NotificationLinkType.State_Trade_Entry,
    linkId: panel.stateTradeEntryId,
  });

  const zonalAdmins = await prisma.userRole.findMany({
    where: {
      zoneId: panel.stateTradeEntry.state.zoneId,
      revokedAt: null,
      role: { name: "Zonal_Admin" },
    },
    select: { userId: true },
  });

  await createMany(
    zonalAdmins.map((a) => a.userId),
    {
      type: NotificationType.PANEL_ASSIGNMENT_OVERDUE,
      title: "An assessor has missed their deadline",
      body: `An assessment for ${panel.stateTradeEntry.trade.name} in ${panel.stateTradeEntry.state.name} is overdue.`,
      linkType: NotificationLinkType.State_Trade_Entry,
      linkId: panel.stateTradeEntryId,
    }
  );
}

/** Moderation case opened — notify the assigned moderator and original assessor. */
export async function notifyModerationOpened(caseId: string) {
  const modCase = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    include: { score: { include: { assessor: true } } },
  });
  if (!modCase) return;

  const recipients = [modCase.moderatorId, modCase.score?.assessorId].filter(
    (id): id is string => Boolean(id)
  );

  await createMany(recipients, {
    type: NotificationType.MODERATION_OPENED,
    title: "A moderation case has been opened",
    body: `A score you're connected to has been flagged for review: "${modCase.reason}"`,
    linkType: NotificationLinkType.Moderation_Case,
    linkId: modCase.id,
  });
}

/** Moderation resolved — notify zonal admin, original assessor, and the applicant. */
export async function notifyModerationResolved(caseId: string) {
  const modCase = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    include: {
      score: {
        include: {
          assessor: true,
          stateTradeEntry: { include: { state: { include: { zone: true } }, trade: true } },
        },
      },
    },
  });
  if (!modCase || !modCase.score) return;

  const zonalAdmins = await prisma.userRole.findMany({
    where: {
      zoneId: modCase.score.stateTradeEntry.state.zoneId,
      revokedAt: null,
      role: { name: "Zonal_Admin" },
    },
    select: { userId: true },
  });

  const applicants = await prisma.user.findMany({
    where: {
      tradeId: modCase.score.stateTradeEntry.tradeId,
      stateId: modCase.score.stateTradeEntry.stateId,
    },
    select: { id: true },
  });

  const recipients = [
    modCase.score.assessorId,
    ...zonalAdmins.map((a) => a.userId),
    ...applicants.map((a) => a.id),
  ];

  await createMany(recipients, {
    type: NotificationType.MODERATION_RESOLVED,
    title: "A moderation case has been resolved",
    body: `The moderation case for ${modCase.score.stateTradeEntry.trade.name} has been resolved: ${modCase.status.replace(/_/g, " ").toLowerCase()}.`,
    linkType: NotificationLinkType.Moderation_Case,
    linkId: modCase.id,
  });
}

/** A sector's entry advanced a stage — notify zonal/national admin and affected applicants. */
export async function notifyPromotion(sectorResultId: string) {
  const result = await prisma.sectorResult.findUnique({
    where: { id: sectorResultId },
    include: { sector: true, state: { include: { zone: true } }, zone: true },
  });
  if (!result) return;

  const locationLabel = result.state?.name ?? result.zone?.name ?? "";

  const adminRoleNames =
    result.stage === "Zonal" ? ["National_Admin"] : ["Zonal_Admin", "National_Admin"];

  const admins = await prisma.userRole.findMany({
    where: {
      revokedAt: null,
      role: { name: { in: adminRoleNames as never[] } },
      OR: [
        { zoneId: result.zoneId },
        { zoneId: result.state?.zoneId },
        { role: { scope: "National" } },
        { role: { scope: "Overall" } },
      ],
    },
    select: { userId: true },
  });

  const applicants = result.stateId
    ? await prisma.user.findMany({
        where: { stateId: result.stateId },
        select: { id: true },
      })
    : [];

  await createMany([...admins.map((a) => a.userId), ...applicants.map((a) => a.id)], {
    type: NotificationType.PROMOTION_OCCURRED,
    title: `${result.sector.name} advanced to the next stage`,
    body: `The ${result.sector.name} sector entry from ${locationLabel} has been promoted to the ${result.stage} stage results.`,
    linkType: NotificationLinkType.Sector_Result,
    linkId: result.id,
  });
}

/** A pending staff registrant needs review — notify the relevant Zonal_Admin(s). */
export async function notifyStaffPendingAppointment(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.intendedZoneId) return;

  const zonalAdmins = await prisma.userRole.findMany({
    where: {
      zoneId: user.intendedZoneId,
      revokedAt: null,
      role: { name: "Zonal_Admin" },
    },
    select: { userId: true },
  });

  await createMany(
    zonalAdmins.map((a) => a.userId),
    {
      type: NotificationType.STAFF_PENDING_APPOINTMENT,
      title: "A new staff registrant needs appointment",
      body: `${user.firstName} ${user.lastName} registered and is awaiting role assignment in your zone.`,
      linkType: NotificationLinkType.Staff_Registration,
      linkId: user.id,
    }
  );
}

/** Role granted or revoked — notify the affected user directly. */
export async function notifyRoleChanged(
  userRoleId: string,
  change: "granted" | "revoked"
) {
  const userRole = await prisma.userRole.findUnique({
    where: { id: userRoleId },
    include: { role: true },
  });
  if (!userRole) return;

  await createNotification({
    recipientId: userRole.userId,
    type: NotificationType.ROLE_CHANGED,
    title: change === "granted" ? "You've been granted a new role" : "A role has been revoked",
    body:
      change === "granted"
        ? `You have been appointed as ${userRole.role.name.replace(/_/g, " ")}.`
        : `Your role as ${userRole.role.name.replace(/_/g, " ")} has been revoked.`,
    linkType: NotificationLinkType.Role_Change,
    linkId: userRole.id,
  });
}
