/**
 * The only door into legacy/.
 *
 * The mailroom is CommonJS with Node-style callbacks. This file loads it,
 * describes the parts we use with TypeScript types, and turns each callback
 * into a promise. Everything else in the API imports from here.
 */
import { createRequire } from 'node:module';
import { promisify } from 'node:util';

type Callback<T> = (err: Error | null, result?: T) => void;

export interface LegacySlaSummary {
  ticketId: number;
  dueAt: string;
  state: 'on-track' | 'at-risk' | 'breached' | 'met' | 'missed' | 'paused';
  remainingMinutes: number | null;
}

export interface LegacyBusinessHours {
  openHour: number;
  closeHour: number;
  timeZone: string;
  slaHours: number;
}

export interface LegacySlaReportRow {
  ticketId: number;
  status: 'open' | 'pending' | 'closed';
  businessMinutes: number;
}

export interface LegacyDelivery {
  filename: string;
  ticketId: number;
  created: boolean;
}

interface LegacyMailroom {
  config: { dbPath: string; inboxDir: string; fixturesDir: string };
  db: { migrate(cb: Callback<void>): void; close(): void };
  cache: { clear(): void; del(key: string): void };
  models: {
    Ticket: { updateStatus(id: number, status: string, cb: Callback<unknown | null>): void };
  };
  businessHours: {
    load(cb: Callback<LegacyBusinessHours>): void;
    save(settings: LegacyBusinessHours, cb: Callback<LegacyBusinessHours>): void;
    get(): LegacyBusinessHours;
  };
  sla: {
    forTicket(ticketId: number, cb: Callback<LegacySlaSummary | null>): void;
    report(cb: Callback<LegacySlaReportRow[]>): void;
  };
  poller: {
    pollOnce(cb: Callback<LegacyDelivery[]>): void;
    start(cb: Callback<boolean>): void;
    stop(): void;
  };
  mailer: {
    sendReply(
      reply: { ticketId: number; teammateId: number; body: string },
      cb: Callback<{ message: { id: number }; outbox: { id: number } } | null>,
    ): void;
  };
  drop: {
    dropFixture(name: string, cb: Callback<string>): void;
    listFixtures(cb: Callback<string[]>): void;
  };
}

const require = createRequire(import.meta.url);
const mailroom = require('@front-desk/legacy') as LegacyMailroom;

const migrate = promisify(mailroom.db.migrate);
const loadBusinessHours = promisify(
  mailroom.businessHours.load,
) as () => Promise<LegacyBusinessHours>;

/** Create the mailroom's tables if they're missing, then load the saved business hours. */
export async function migrateLegacy(): Promise<void> {
  await migrate();
  await loadBusinessHours();
}

/** Ingest every unseen file in the inbox now, without waiting for the poller. */
export const pollInbox = promisify(mailroom.poller.pollOnce) as () => Promise<LegacyDelivery[]>;

/** Start the background poller. Resolves false if another process holds the lock. */
export const startMailroom = promisify(mailroom.poller.start) as () => Promise<boolean>;

export function stopMailroom(): void {
  mailroom.poller.stop();
}

export function closeLegacy(): void {
  mailroom.poller.stop();
  mailroom.db.close();
  mailroom.cache.clear();
}

export const getSla = promisify(mailroom.sla.forTicket) as (
  ticketId: number,
) => Promise<LegacySlaSummary | null>;

/** Drop a ticket's cached SLA after a write that bypassed the Ticket model. */
export function clearSlaCache(id: number): void {
  mailroom.cache.del('sla:' + id);
}

/**
 * Change a ticket's status through the mailroom's model, which pairs `state`,
 * stamps `closed_at`, logs SLA pauses and clears the cached SLA. Resolves null
 * when the ticket doesn't exist.
 */
export const updateTicketStatus = promisify(mailroom.models.Ticket.updateStatus) as (
  id: number,
  status: string,
) => Promise<unknown | null>;

/**
 * Record a reply on the ticket and queue it in the outbox. Resolves with the
 * new message's id, or null when the ticket doesn't exist.
 */
export async function sendReply(reply: {
  ticketId: number;
  teammateId: number;
  body: string;
}): Promise<number | null> {
  const send = promisify(mailroom.mailer.sendReply) as (
    r: typeof reply,
  ) => Promise<{ message: { id: number } } | null>;
  const result = await send(reply);
  return result ? result.message.id : null;
}

export const dropFixture = promisify(mailroom.drop.dropFixture) as (
  name: string,
) => Promise<string>;

export const listFixtures = promisify(mailroom.drop.listFixtures) as () => Promise<string[]>;

/** The desk's current business hours, as saved. */
export async function getBusinessHours(): Promise<LegacyBusinessHours> {
  return loadBusinessHours();
}

/** Save new business hours. Every cached SLA is dropped, so the next read uses them. */
export const saveBusinessHours = promisify(mailroom.businessHours.save) as (
  settings: LegacyBusinessHours,
) => Promise<LegacyBusinessHours>;

/** Every ticket's business minutes under the current settings. */
export const getSlaReport = promisify(mailroom.sla.report) as () => Promise<LegacySlaReportRow[]>;
