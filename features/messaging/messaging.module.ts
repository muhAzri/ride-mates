/**
 * Composition root for the Messaging feature — the one place that knows concrete
 * implementations. Wires the Supabase repository into the use-cases (conversations,
 * messages, read markers) and exposes a ready controller. Route Handlers import
 * only `messagingController`. The repository is also reused by the realtime
 * transport to hydrate `message.created` events.
 */
import { SupabaseMessagingRepository } from './infrastructure/supabase-messaging.repository';
import { ListConversationsUseCase } from './application/list-conversations.usecase';
import { OpenConversationUseCase } from './application/open-conversation.usecase';
import { GetConversationUseCase } from './application/get-conversation.usecase';
import { ListMessagesUseCase } from './application/list-messages.usecase';
import { SendMessageUseCase } from './application/send-message.usecase';
import { MarkConversationReadUseCase } from './application/mark-conversation-read.usecase';
import { MessagingController } from './presentation/messaging.controller';

const repository = new SupabaseMessagingRepository();

export const messagingController = new MessagingController({
  listConversations: new ListConversationsUseCase(repository),
  openConversation: new OpenConversationUseCase(repository),
  getConversation: new GetConversationUseCase(repository),
  listMessages: new ListMessagesUseCase(repository),
  sendMessage: new SendMessageUseCase(repository),
  markRead: new MarkConversationReadUseCase(repository),
});
