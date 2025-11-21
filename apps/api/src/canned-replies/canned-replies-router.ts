import { Router } from 'express';

import type { CannedReply, Message } from '@front-desk/contract';

import type { Database } from '../database.ts';
import { idParam, notFound, parse } from '../http.ts';
import { sendReply } from '../legacy-adapter.ts';
import { findMessage } from '../tickets/tickets-repository.ts';
import {
  createCannedReply,
  findCannedReply,
  findTemplateContext,
  listCannedReplies,
} from './canned-replies-repository.ts';
import { cannedReplyInputSchema, sendCannedReplySchema } from './canned-replies-schemas.ts';
import { renderCannedReply } from './render-canned-reply.ts';

export function cannedRepliesRouter(db: Database): Router {
  const router = Router();

  router.get('/canned-replies', (_req, res) => {
    res.json(listCannedReplies(db) satisfies CannedReply[]);
  });

  router.post('/canned-replies', (req, res) => {
    const input = parse(cannedReplyInputSchema, req.body);
    res.status(201).json(createCannedReply(db, input) satisfies CannedReply);
  });

  /**
   * Templates live in the API's own table, but sending goes through the
   * mailroom like any other reply so it lands in the outbox.
   */
  router.post('/tickets/:ticketId/canned-replies/:cannedReplyId', async (req, res) => {
    const ticketId = parse(idParam, req.params.ticketId);
    const cannedReplyId = parse(idParam, req.params.cannedReplyId);
    const { teammateId } = parse(sendCannedReplySchema, req.body);

    const template = findCannedReply(db, cannedReplyId);
    if (!template) throw notFound('Canned reply');
    const context = findTemplateContext(db, ticketId, teammateId);
    if (!context) throw notFound('Ticket or teammate');

    const messageId = await sendReply({
      ticketId,
      teammateId,
      body: renderCannedReply(template.body, context),
    });
    if (messageId === null) throw notFound('Ticket');
    res.status(201).json(findMessage(db, messageId) satisfies Message | null);
  });

  return router;
}
