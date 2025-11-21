import { Router } from 'express';

import type { Tag } from '@front-desk/contract';

import type { Database } from '../database.ts';
import { HttpError, idParam, notFound, parse } from '../http.ts';
import { ticketExists } from '../tickets/tickets-repository.ts';
import {
  addTagToTicket,
  createTag,
  findTag,
  findTagByName,
  listTags,
  removeTagFromTicket,
  tagsForTicket,
} from './tags-repository.ts';
import { tagInputSchema } from './tags-schemas.ts';

export function tagsRouter(db: Database): Router {
  const router = Router();

  router.get('/tags', (_req, res) => {
    res.json(listTags(db) satisfies Tag[]);
  });

  router.post('/tags', (req, res) => {
    const input = parse(tagInputSchema, req.body);
    if (findTagByName(db, input.name)) {
      throw new HttpError(409, `A tag named "${input.name}" already exists`);
    }
    res.status(201).json(createTag(db, input) satisfies Tag);
  });

  router.put('/tickets/:ticketId/tags/:tagId', (req, res) => {
    const { ticketId, tagId } = requireTicketAndTag(db, req.params);
    addTagToTicket(db, ticketId, tagId);
    res.json(tagsForTicket(db, ticketId) satisfies Tag[]);
  });

  router.delete('/tickets/:ticketId/tags/:tagId', (req, res) => {
    const { ticketId, tagId } = requireTicketAndTag(db, req.params);
    removeTagFromTicket(db, ticketId, tagId);
    res.json(tagsForTicket(db, ticketId) satisfies Tag[]);
  });

  return router;
}

function requireTicketAndTag(
  db: Database,
  params: Record<string, string | undefined>,
): { ticketId: number; tagId: number } {
  const ticketId = parse(idParam, params.ticketId);
  const tagId = parse(idParam, params.tagId);
  if (!ticketExists(db, ticketId)) throw notFound('Ticket');
  if (!findTag(db, tagId)) throw notFound('Tag');
  return { ticketId, tagId };
}
