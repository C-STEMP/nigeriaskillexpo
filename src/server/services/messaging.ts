import { prisma } from "@/lib/prisma";
import { ConversationKind, BroadcastTargetType, UserType, NotificationType, NotificationLinkType } from "@prisma/client";
import type { ActiveRole } from "@/lib/permissions";
import {
  assertCanMessageDirect,
  resolveBroadcastRecipients,
} from "@/lib/permissions/messaging";

async function notifyNewMessage(
  recipientIds: string[],
  conversationId: string,
  senderName: string,
  preview: string
) {
  if (recipientIds.length === 0) return;
  await prisma.notification.createMany({
    data: recipientIds.map((recipientId) => ({
      recipientId,
      type: NotificationType.NEW_MESSAGE,
      title: `New message from ${senderName}`,
      body: preview.length > 140 ? `${preview.slice(0, 137)}...` : preview,
      linkType: NotificationLinkType.Conversation,
      linkId: conversationId,
    })),
  });
}

async function getSenderDisplayName(senderId: string): Promise<string> {
  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  if (!sender) return "Someone";
  return sender.organizationName ?? `${sender.firstName ?? ""} ${sender.lastName ?? ""}`.trim();
}

/** Starts (or reuses) a direct 1-to-1 conversation and posts the first message. */
export async function sendDirectMessage(
  senderId: string,
  senderRoles: ActiveRole[],
  recipientId: string,
  body: string,
  subject?: string
) {
  await assertCanMessageDirect(senderId, senderRoles, recipientId);

  // Reuse an existing direct conversation between these two if one exists,
  // rather than spawning a new thread every time — this is meant to feel
  // like an inbox, not a fresh ticket per message.
  let conversation = await prisma.conversation.findFirst({
    where: {
      kind: ConversationKind.Direct,
      participants: { some: { userId: senderId } },
      AND: { participants: { some: { userId: recipientId } } },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        kind: ConversationKind.Direct,
        subject,
        participants: {
          create: [{ userId: senderId }, { userId: recipientId }],
        },
      },
    });
  }

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId, body },
  });

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: conversation.id, userId: senderId } },
    data: { lastReadAt: new Date() },
  });

  const senderName = await getSenderDisplayName(senderId);
  await notifyNewMessage([recipientId], conversation.id, senderName, body);

  return { conversation, message };
}

/** Creates a broadcast conversation targeted at a resolved audience, posts the first message. */
export async function sendBroadcastMessage(
  senderId: string,
  senderRoles: ActiveRole[],
  body: string,
  target: {
    type: "Everyone" | "Specific_Role" | "Specific_Zone" | "Specific_Role_In_Zone";
    role?: UserType;
    zoneId?: string;
  },
  subject?: string
) {
  const recipientIds = await resolveBroadcastRecipients(senderRoles, target);
  // Sender themself shouldn't be a "recipient" of their own broadcast.
  const filteredRecipients = recipientIds.filter((id) => id !== senderId);

  const conversation = await prisma.conversation.create({
    data: {
      kind: ConversationKind.Broadcast,
      subject,
      broadcastTargetType: target.type as BroadcastTargetType,
      broadcastTargetRole: target.role,
      broadcastTargetZoneId: target.zoneId,
      participants: {
        create: [
          { userId: senderId },
          ...filteredRecipients.map((userId) => ({ userId })),
        ],
      },
    },
  });

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId, body },
  });

  const senderName = await getSenderDisplayName(senderId);
  await notifyNewMessage(filteredRecipients, conversation.id, senderName, body);

  return { conversation, message, recipientCount: filteredRecipients.length };
}

/**
 * Replies within an existing conversation. For a broadcast, a reply from
 * someone other than the original sender spins off a NEW Direct
 * conversation (linked via parentBroadcastId) rather than posting into the
 * shared broadcast thread — this is what keeps "reply to a broadcast"
 * from becoming a reply-all blast to the entire original audience.
 */
export async function replyToConversation(
  senderId: string,
  senderRoles: ActiveRole[],
  conversationId: string,
  body: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true, messages: { take: 1, orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) throw new Error("Conversation not found.");

  const isParticipant = conversation.participants.some((p) => p.userId === senderId);
  if (!isParticipant) throw new Error("You are not part of this conversation.");

  if (conversation.kind === ConversationKind.Direct) {
    const otherParticipant = conversation.participants.find((p) => p.userId !== senderId);
    if (!otherParticipant) throw new Error("Conversation has no other participant.");

    const message = await prisma.message.create({
      data: { conversationId, senderId, body },
    });
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      data: { lastReadAt: new Date() },
    });
    const senderName = await getSenderDisplayName(senderId);
    await notifyNewMessage([otherParticipant.userId], conversationId, senderName, body);
    return { conversation, message };
  }

  // Broadcast reply: spin off a Direct conversation with the original sender.
  const originalSenderId = conversation.messages[0]?.senderId;
  if (!originalSenderId) throw new Error("Original broadcast sender not found.");
  if (originalSenderId === senderId) {
    throw new Error("Use a direct message to follow up with a specific recipient.");
  }

  let sideThread = await prisma.conversation.findFirst({
    where: {
      kind: ConversationKind.Direct,
      parentBroadcastId: conversationId,
      participants: { some: { userId: senderId } },
      AND: { participants: { some: { userId: originalSenderId } } },
    },
  });

  if (!sideThread) {
    sideThread = await prisma.conversation.create({
      data: {
        kind: ConversationKind.Direct,
        parentBroadcastId: conversationId,
        subject: conversation.subject ? `Re: ${conversation.subject}` : "Re: broadcast",
        participants: {
          create: [{ userId: senderId }, { userId: originalSenderId }],
        },
      },
    });
  }

  const message = await prisma.message.create({
    data: { conversationId: sideThread.id, senderId, body },
  });
  const senderName = await getSenderDisplayName(senderId);
  await notifyNewMessage([originalSenderId], sideThread.id, senderName, body);

  return { conversation: sideThread, message };
}
