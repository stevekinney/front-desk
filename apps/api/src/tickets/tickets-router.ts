import { Router } from 'express';

import type { Message, Ticket, TicketDetail } from '@front-desk/contract';

import type { Database } from '../database.ts';
import { HttpError, idParam, notFound, parse } from '../http.ts';
import { sendReply, updateTicketStatus } from '../legacy-adapter.ts';
import {
  assignTicket,
  findMessage,
  findTicketRecord,
  listMessages,
  listTicketRecords,
  teammateExists,
  ticketExists,
} from './tickets-repository.ts';
import {
  assignSchema,
  listTicketsQuerySchema,
  replySchema,
  updateStatusSchema,
} from './tickets-schemas.ts';
import { withSla } from './with-sla.ts';

export function ticketsRouter(db: Database): Router {
  const router = Router();

  async function loadTicket(id: number): Promise<Ticket> {
    const record = findTicketRecord(db, id);
    if (!record) throw notFound('Ticket');
    return withSla(record);
  }

  router.get('/tickets', async (req, res) => {
    const query = parse(listTicketsQuerySchema, req.query);
    const tickets: Ticket[] = await Promise.all(listTicketRecords(db, query).map(withSla));
    res.json(tickets);
  });

  router.get('/tickets/:ticketId', async (req, res) => {
    const id = parse(idParam, req.params.ticketId);
    const ticket = await loadTicket(id);
    const detail: TicketDetail = { ...ticket, messages: listMessages(db, id) };
    res.json(detail);
  });

  router.patch('/tickets/:ticketId/status', async (req, res) => {
    const id = parse(idParam, req.params.ticketId);
    const { status } = parse(updateStatusSchema, req.body);
    const updated = await updateTicketStatus(id, status);
    if (!updated) throw notFound('Ticket');
    res.json(await loadTicket(id));
  });

  router.put('/tickets/:ticketId/assignee', async (req, res) => {
    const id = parse(idParam, req.params.ticketId);
    const { teammateId } = parse(assignSchema, req.body);
    if (!ticketExists(db, id)) throw notFound('Ticket');
    if (teammateId !== null && !teammateExists(db, teammateId)) {
      throw new HttpError(400, `No teammate with id ${teammateId}`);
    }
    assignTicket(db, id, teammateId);
    res.json(await loadTicket(id));
  });

  router.post('/tickets/:ticketId/replies', async (req, res) => {
    const id = parse(idParam, req.params.ticketId);
    const reply = parse(replySchema, req.body);
    if (!teammateExists(db, reply.teammateId)) {
      throw new HttpError(400, `No teammate with id ${reply.teammateId}`);
    }
    const messageId = await sendReply({ ticketId: id, ...reply });
    if (messageId === null) throw notFound('Ticket');
    res.status(201).json(findMessage(db, messageId) satisfies Message | null);
  });

  return router;
}
