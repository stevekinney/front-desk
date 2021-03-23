'use strict';

/**
 * VIP mail is urgent, and it shouldn't sit in the queue. If nobody has
 * picked it up, it goes to the longest-serving teammate.
 */

module.exports = {
  name: 'escalate-vip',

  /** @param {any} ticket */
  when: function (ticket) {
    return Boolean(ticket.customer.vip) && ticket.state !== 'resolved';
  },

  /**
   * @param {any} ticket
   * @param {any} ctx
   * @param {(err: Error | null) => void} cb
   */
  run: function (ticket, ctx, cb) {
    function assignLead() {
      const lead = ctx.teammates[0];
      if (ticket.assignee_id || !lead) return cb(null);
      ctx.assign(lead.id, cb);
    }
    if (ticket.tags.indexOf('urgent') !== -1) return assignLead();
    ctx.addTag('urgent', function (err) {
      if (err) return cb(err);
      assignLead();
    });
  },
};
