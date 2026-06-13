/**
 * Maps messaging domain models to the exact JSON wire shapes (API_CONTRACT.md
 * §10, §17.5, §17.6). These same mappers shape the realtime `message.created`
 * payload, so the transport and REST stay byte-identical.
 */
import type { Conversation, ListingRef, Message, UserMini } from '../domain/messaging.types';

function toUserMiniDto(user: UserMini) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    cyclingType: user.cyclingType,
    ratingAverage: user.ratingAverage,
  };
}

function toListingRefDto(listing: ListingRef) {
  return {
    id: listing.id,
    title: listing.title,
    priceIdr: listing.priceIdr,
    photoUrl: listing.photoUrl,
  };
}

/** Conversation summary (§17.5). */
export function toConversationDto(conversation: Conversation) {
  return {
    id: conversation.id,
    otherParticipant: toUserMiniDto(conversation.otherParticipant),
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: conversation.unreadCount,
  };
}

/** Message (§17.6). `listingRef` is null unless a listing was shared (MS-3). */
export function toMessageDto(message: Message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    listingRef: message.listingRef ? toListingRefDto(message.listingRef) : null,
    createdAt: message.createdAt,
  };
}
