'use strict';

/**
 * When the customer writes back, the ticket needs a teammate again.
 *
 * A closed ticket only reopens if it was closed in the last fourteen days.
 * After that, the customer is usually answering an old thread about
 * something new.
 */

const DAY = 24 * 60 * 60 * 1000;
const REOPEN_WITHIN_DAYS = 14;

module.exports = {
  name: 'reopen-on-reply',

  /** @param {any} ticket */
  when: function (ticket) {
    return (
      Boolean(ticket.message) && ticket.message.direction === 'inbound' && ticket.state !== 'active'
    );
  },

  /**
   * @param {any} ticket
   * @param {any} ctx
   * @param {(err: Error | null) => void} cb
   */
  run: function (ticket, ctx, cb) {
    if (ticket.state === 'resolved') {
      const closedFor = ctx.now.getTime() - new Date(ticket.closed_at).getTime();
      if (closedFor > REOPEN_WITHIN_DAYS * DAY) {
        ctx.log('#' + ticket.id + ' was closed too long ago to reopen');
        return setImmediate(cb, null);
      }
    }
    ctx.setState('active', cb);
  },
};
