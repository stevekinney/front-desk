/**
 * Render the whole web app against a fake API. Unlike the unit tests' mock,
 * routes match on method and path and receive the query, so a test can
 * describe how the server answers without fixing the exact URL the page
 * builds.
 */
import { vi } from 'vitest';

export { renderApp } from '../../apps/web/test/render.tsx';
export { makeTicket, makeTicketDetail, priya, dana } from '../../apps/web/test/mock-api.ts';

export interface FakeRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

/** Return a value to answer 200, or `reply(status, body)` for anything else. */
export type FakeHandler = (request: FakeRequest) => unknown;

const REPLY = Symbol('reply');

export function reply(status: number, body: unknown): unknown {
  return { [REPLY]: true, status, body };
}

export interface FakeApi {
  on(method: string, path: string | RegExp, handler: FakeHandler | object): FakeApi;
  calls: FakeRequest[];
}

export function fakeApi(): FakeApi {
  const routes: Array<{ method: string; path: string | RegExp; handler: FakeHandler }> = [];
  const api: FakeApi = {
    calls: [],
    on(method, path, handler) {
      routes.unshift({
        method,
        path,
        handler: typeof handler === 'function' ? (handler as FakeHandler) : () => handler,
      });
      return api;
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost');
      const request: FakeRequest = {
        method: init?.method ?? 'GET',
        path: url.pathname.replace(/^\/api/, ''),
        query: url.searchParams,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      api.calls.push(request);
      const route = routes.find(
        (r) =>
          r.method === request.method &&
          (typeof r.path === 'string' ? r.path === request.path : r.path.test(request.path)),
      );
      if (!route) {
        return new Response(
          JSON.stringify({ error: `No fake for ${request.method} ${request.path}` }),
          { status: 404 },
        );
      }
      const result = route.handler(request) as Record<PropertyKey, unknown> | undefined;
      if (result && typeof result === 'object' && REPLY in result) {
        return new Response(JSON.stringify(result.body), { status: result.status as number });
      }
      return new Response(JSON.stringify(result ?? null), { status: 200 });
    }),
  );
  return api;
}
