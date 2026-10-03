/**
 * A rule context that records what a rule asks for instead of doing it.
 */

/**
 * @param {{ now?: string, teammates?: Array<{ id: number, name: string }> }} [options]
 */
export function recordingContext(options = {}) {
  const effects = [];
  let ticket = null;
  const ctx = {
    now: new Date(options.now ?? '2026-10-07T15:00:00.000Z'),
    teammates: options.teammates ?? [],
    effects,
    /** Changes are applied to this ticket, the way the real context does. */
    bind(target) {
      ticket = target;
      return ctx;
    },
    setStatus(status, cb) {
      effects.push({ type: 'setStatus', status });
      if (ticket) ticket.status = status;
      setImmediate(cb, null);
    },
    assign(teammateId, cb) {
      effects.push({ type: 'assign', teammateId });
      if (ticket) ticket.assignee_id = teammateId;
      setImmediate(cb, null);
    },
    addTag(tag, cb) {
      effects.push({ type: 'addTag', tag });
      if (ticket && !ticket.tags.includes(tag)) ticket.tags.push(tag);
      setImmediate(cb, null);
    },
    log() {},
  };
  return ctx;
}

/**
 * @param {object} [overrides]
 */
export function ruleTicket(overrides = {}) {
  return {
    id: 1,
    subject: 'Question about my order',
    status: 'open',
    assignee_id: null,
    created_at: '2026-10-06T14:00:00.000Z',
    updated_at: '2026-10-06T14:00:00.000Z',
    closed_at: null,
    customer: { name: 'Ana Souza', email: 'ana@example.com', vip: false },
    tags: [],
    message: { direction: 'inbound', body: 'Hello?', created_at: '2026-10-07T14:55:00.000Z' },
    ...overrides,
  };
}

/**
 * Run a rule the way the mailroom does: only if `when` says so.
 */
export function apply(rule, ticket, ctx) {
  ctx.bind(ticket);
  if (!rule.when(ticket)) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    rule.run(ticket, ctx, (err) => (err ? reject(err) : resolve(true)));
  });
}
