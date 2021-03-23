'use strict';

/**
 * Close tickets that have been waiting on the customer for too long.
 *
 * Seven days without a word, or fourteen for VIP customers, who tend to be
 * slower to answer and quicker to complain.
 */

const DAY = 24 * 60 * 60 * 1000;
const WAIT_DAYS = 7;
const VIP_WAIT_DAYS = 14;

module.exports = {
  name: 'auto-close-stale',

  /** @param {any} ticket */
  when: function (ticket) {
    return ticket.state === 'on_hold';
  },

  /**
   * @param {any} ticket
   * @param {any} ctx
   * @param {(err: Error | null) => void} cb
   */
  run: function (ticket, ctx, cb) {
    const waitDays = ticket.customer.vip ? VIP_WAIT_DAYS : WAIT_DAYS;
    const idle = ctx.now.getTime() - new Date(ticket.updated_at).getTime();
    if (idle < waitDays * DAY) return setImmediate(cb, null);
    ctx.log('closing #' + ticket.id + ' after ' + Math.floor(idle / DAY) + ' days on hold');
    ctx.setState('resolved', cb);
  },
};
