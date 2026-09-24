import { vi } from 'vitest';

import type { Sla, Teammate, Ticket, TicketDetail } from '@front-desk/contract';

type Handler = (body: unknown, url: URL) => unknown;

export interface MockApi {
  /** Respond with the handler's return value, or with a fixed value. */
  on(method: string, path: string, handler: Handler): MockApi;
  on(method: string, path: string, response: object): MockApi;
  calls: Array<{ method: string; path: string; body: unknown }>;
}

/**
 * Replace fetch with a tiny router. Paths are matched exactly, including the
 * query string, relative to /api.
 */
export function mockApi(): MockApi {
  const routes = new Map<string, Handler>();
  const api: MockApi = {
    calls: [],
    on(method: string, path: string, handler: unknown) {
      routes.set(
        `${method} ${path}`,
        typeof handler === 'function' ? (handler as Handler) : () => handler,
      );
      return api;
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace(/^\/api/, '') + url.search;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      api.calls.push({ method, path, body });
      const handler = routes.get(`${method} ${path}`);
      if (!handler) {
        return new Response(JSON.stringify({ error: `No mock for ${method} ${path}` }), {
          status: 404,
        });
      }
      return new Response(JSON.stringify(handler(body, url)), { status: 200 });
    }),
  );
  return api;
}

export const priya: Teammate = { id: 1, name: 'Priya Raman', email: 'priya@frontdesk.example' };
export const dana: Teammate = { id: 2, name: 'Dana Whitfield', email: 'dana@frontdesk.example' };

export const onTrack: Sla = {
  dueAt: '2026-10-06T20:00:00.000Z',
  state: 'on-track',
  remainingMinutes: 300,
};

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    subject: 'Business cards arrived bent',
    status: 'open',
    customer: { id: 1, name: 'Theo Brandt', email: 'theo@example.com', vip: false },
    assignee: null,
    tags: [],
    sla: onTrack,
    messageCount: 1,
    createdAt: '2026-10-06T13:00:00.000Z',
    updatedAt: '2026-10-06T13:00:00.000Z',
    closedAt: null,
    ...overrides,
  };
}

export function makeTicketDetail(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    ...makeTicket(),
    messages: [
      {
        id: 10,
        direction: 'inbound',
        author: null,
        fromName: 'Theo Brandt',
        fromEmail: 'theo@example.com',
        body: 'About a third of them are bent.',
        sentAt: '2026-10-06T13:00:00.000Z',
        createdAt: '2026-10-06T13:00:00.000Z',
        delivery: null,
      },
    ],
    ...overrides,
  };
}
