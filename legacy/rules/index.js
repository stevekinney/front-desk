'use strict';

/**
 * Automation rules.
 *
 * Every rule has the same shape:
 *
 *   {
 *     name: 'tag-billing',
 *     when: function (ticket) { return true; },   // should this rule look at the ticket?
 *     run: function (ticket, ctx, cb) { ... },     // make changes through ctx, then cb(err)
 *   }
 *
 * They run in the order below, on every message the mailroom ingests and
 * once an hour from cron (bin/sweep-rules.js).
 */

const context = require('./context');

const RULES = [
  require('./reopen-on-reply'),
  require('./tag-billing'),
  require('./escalate-vip'),
  require('./assign-round-robin'),
  require('./auto-close-stale'),
];

/**
 * Run every rule that applies, one after another. A rule that fails is
 * logged and skipped; it never stops mail from being ingested.
 *
 * @param {any} ticket
 * @param {any} ctx
 * @param {(err: Error | null) => void} cb
 */
function runRules(ticket, ctx, cb) {
  (function next(i) {
    if (i >= RULES.length) return cb(null);
    const rule = RULES[i];
    if (!rule.when(ticket)) return next(i + 1);
    rule.run(ticket, ctx, function (/** @type {Error | null} */ err) {
      if (err)
        console.error('[rules] ' + rule.name + ' failed on #' + ticket.id + ': ' + err.message);
      next(i + 1);
    });
  })(0);
}

/**
 * @param {number} ticketId
 * @param {any} message  The message that triggered the run, or null.
 * @param {(err: Error | null) => void} cb
 */
function applyTo(ticketId, message, cb) {
  context.loadTicket(ticketId, message, function (err, ticket) {
    if (err) return cb(err);
    if (!ticket) return cb(null);
    context.createContext(ticket, function (ctxErr, ctx) {
      if (ctxErr) return cb(ctxErr);
      runRules(ticket, ctx, cb);
    });
  });
}

/** @param {string} name */
function byName(name) {
  for (let i = 0; i < RULES.length; i++) {
    if (RULES[i].name === name) return RULES[i];
  }
  return null;
}

module.exports = { rules: RULES, runRules: runRules, applyTo: applyTo, byName: byName };
