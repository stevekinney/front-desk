'use strict';

/**
 * Share new tickets out evenly: each one goes to the next teammate in line.
 * Spam is left for whoever empties the spam folder.
 */

let next = 0;

module.exports = {
  name: 'assign-round-robin',

  /** @param {any} ticket */
  when: function (ticket) {
    return !ticket.assignee_id && ticket.status === 'open';
  },

  /**
   * @param {any} ticket
   * @param {any} ctx
   * @param {(err: Error | null) => void} cb
   */
  run: function (ticket, ctx, cb) {
    if (ticket.tags.indexOf('spam') !== -1) return setImmediate(cb, null);
    if (ctx.teammates.length === 0) return setImmediate(cb, null);
    const teammate = ctx.teammates[next % ctx.teammates.length];
    next += 1;
    ctx.assign(teammate.id, cb);
  },
};
