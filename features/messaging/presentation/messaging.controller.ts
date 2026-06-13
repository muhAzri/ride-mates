/**
 * HTTP boundary for the Messaging feature (API_CONTRACT.md §10). Maps requests to
 * use-cases and results to responses — no business logic, no data access.
 * Use-cases are injected (wiring lives in `messaging.module.ts`).
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import { decodeCursor } from '@/shared/http/pagination';
import type { ListConversationsUseCase } from '../application/list-conversations.usecase';
import type { OpenConversationUseCase } from '../application/open-conversation.usecase';
import type { GetConversationUseCase } from '../application/get-conversation.usecase';
import type { ListMessagesUseCase } from '../application/list-messages.usecase';
import type { SendMessageUseCase } from '../application/send-message.usecase';
import type { MarkConversationReadUseCase } from '../application/mark-conversation-read.usecase';
import { listQuerySchema, openConversationSchema, sendMessageSchema } from './messaging.schemas';
import { toConversationDto, toMessageDto } from './messaging.mapper';

export interface MessagingUseCases {
  listConversations: ListConversationsUseCase;
  openConversation: OpenConversationUseCase;
  getConversation: GetConversationUseCase;
  listMessages: ListMessagesUseCase;
  sendMessage: SendMessageUseCase;
  markRead: MarkConversationReadUseCase;
}

export class MessagingController {
  constructor(private readonly useCases: MessagingUseCases) {}

  /** GET /conversations (MS-4). */
  async listConversations(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { limit } = parseInput(listQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const page = await this.useCases.listConversations.execute(accessToken, limit, offset);
    return json({ data: page.data.map(toConversationDto), page: page.page }, 200);
  }

  /** POST /conversations (MP-6, MS-1). Idempotent per pair → `200`. */
  async openConversation(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(openConversationSchema, await readJsonBody(request));
    const conversation = await this.useCases.openConversation.execute(accessToken, body);
    return json(toConversationDto(conversation), 200);
  }

  /** GET /conversations/{id} (MS-1). */
  async getConversation(request: NextRequest, conversationId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const conversation = await this.useCases.getConversation.execute(accessToken, conversationId);
    return json(toConversationDto(conversation), 200);
  }

  /** GET /conversations/{id}/messages (MS-2). */
  async listMessages(request: NextRequest, conversationId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { limit } = parseInput(listQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const page = await this.useCases.listMessages.execute(accessToken, conversationId, limit, offset);
    return json({ data: page.data.map(toMessageDto), page: page.page }, 200);
  }

  /** POST /conversations/{id}/messages (MS-2, MS-3). */
  async sendMessage(request: NextRequest, conversationId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const body = parseInput(sendMessageSchema, await readJsonBody(request));
    const message = await this.useCases.sendMessage.execute(accessToken, conversationId, body);
    return json(toMessageDto(message), 201);
  }

  /** POST /conversations/{id}/read (MS-4). */
  async markRead(request: NextRequest, conversationId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    await this.useCases.markRead.execute(accessToken, conversationId);
    return json({ readAt: new Date().toISOString() }, 200);
  }

  private requireToken(request: NextRequest): string {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return accessToken;
  }
}
