'use strict';

/**
 * Tag anything that sounds like money. Disputes and double charges are
 * urgent too, because the card company won't wait.
 */

const BILLING = /\b(refund|invoice|receipt|billing|billed|charge[sd]?|payment|vat)\b/i;
const DISPUTE = /\b(chargeback|charged twice|double charge|disputed?)\b/i;

module.exports = {
  name: 'tag-billing',

  /** @param {any} ticket */
  when: function (ticket) {
    return Boolean(ticket.message) && ticket.message.direction === 'inbound';
  },

  /**
   * @param {any} ticket
   * @param {any} ctx
   * @param {(err: Error | null) => void} cb
   */
  run: function (ticket, ctx, cb) {
    const text = ticket.subject + '\n' + ticket.message.body;
    const wanted = [];
    if (BILLING.test(text) || DISPUTE.test(text)) wanted.push('billing');
    if (DISPUTE.test(text)) wanted.push('urgent');
    const missing = wanted.filter(function (tag) {
      return ticket.tags.indexOf(tag) === -1;
    });

    (function next(i) {
      if (i >= missing.length) return cb(null);
      ctx.addTag(missing[i], function (/** @type {Error | null} */ err) {
        if (err) return cb(err);
        next(i + 1);
      });
    })(0);
  },
};
