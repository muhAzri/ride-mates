/**
 * Messaging domain models (API_CONTRACT.md §10, §17.5, §17.6; FSD §5.4 MS-1..4,
 * MP-6). Transport- and store-agnostic. Conversations are strictly 1:1 and
 * idempotent per pair (the DB stores the pair ordered + unique). A message
 * carries text and/or a shared listing reference (MS-3); never media in MVP.
 */

export type CyclingType = 'road' | 'mtb' | 'gravel' | 'folding' | 'casual';

/** Public participant mini-card (§17.1 public projection). */
export interface UserMini {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  cyclingType: CyclingType | null;
  ratingAverage: number | null;
}

/** A shared-listing reference rendered as a card in chat (§17.6, MS-3). */
export interface ListingRef {
  id: string;
  title: string;
  priceIdr: number;
  photoUrl: string | null;
}

/** A 1:1 conversation summary (§17.5). */
export interface Conversation {
  id: string;
  otherParticipant: UserMini;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

/** A single message (§17.6). `body` is null when only a listing is shared. */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  listingRef: ListingRef | null;
  createdAt: string;
}

/** POST /conversations — open / contact seller (MP-6, MS-1). */
export interface OpenConversationCommand {
  recipientId: string;
  /** Optional listing to pre-link the chat to (MP-6). */
  listingRef?: string;
}

/** POST /conversations/{id}/messages — send (MS-2, MS-3). */
export interface SendMessageCommand {
  body?: string;
  listingRef?: string;
}
