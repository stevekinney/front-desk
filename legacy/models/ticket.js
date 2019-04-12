'use strict';

const defineModel = require('../lib/model');
const cache = require('../lib/cache');
const clock = require('../lib/clock');

const STATES = ['active', 'on_hold', 'resolved'];

/**
 * A conversation with one customer.
 *
 * state is one of: active, on_hold (waiting on the customer), resolved.
 */
const Ticket = defineModel({
  table: 'tickets',
  columns: [
    'subject',
    'customer_id',
    'assignee_id',
    'state',
    'created_at',
    'updated_at',
    'closed_at',
  ],
  beforeSave: function (ticket) {
    const now = clock.isoNow();
    if (!ticket.state) ticket.state = 'active';
    if (!ticket.created_at) ticket.created_at = now;
    ticket.updated_at = now;
  },
  afterSave: function (ticket, cb) {
    // The SLA summary is derived from the ticket row; drop it so the next
    // read recomputes.
    cache.del('sla:' + ticket.id);
    cb(null);
  },
});

Ticket.STATES = STATES;

/**
 * Change a ticket's state, stamping or clearing closed_at.
 *
 * @param {number} id
 * @param {string} state
 * @param {(err: Error | null, ticket?: any) => void} cb
 */
Ticket.updateState = function (id, state, cb) {
  if (STATES.indexOf(state) === -1) {
    return setImmediate(cb, new Error('Unknown state: ' + state));
  }
  Ticket.find(id, function (err, ticket) {
    if (err) return cb(err);
    if (!ticket) return cb(null, null);
    if (ticket.state === state) return cb(null, ticket);
    ticket.state = state;
    ticket.closed_at = state === 'resolved' ? clock.isoNow() : null;
    ticket.save(function (/** @type {Error | null} */ saveErr) {
      if (saveErr) return cb(saveErr);
      cb(null, ticket);
    });
  });
};

module.exports = Ticket;
