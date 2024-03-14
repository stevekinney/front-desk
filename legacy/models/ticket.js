'use strict';

const defineModel = require('../lib/model');
const cache = require('../lib/cache');
const clock = require('../lib/clock');

const STATUSES = ['open', 'pending', 'closed'];

/**
 * The names `state` used before `status` existed, for each status.
 *
 * @type {Object<string, string>}
 */
const STATE_FOR_STATUS = {
  open: 'active',
  pending: 'on_hold',
  closed: 'resolved',
};

/**
 * A conversation with one customer.
 *
 * status is one of: open, pending (waiting on the customer), closed.
 */
const Ticket = defineModel({
  table: 'tickets',
  columns: [
    'subject',
    'customer_id',
    'assignee_id',
    'status',
    'state',
    'created_at',
    'updated_at',
    'closed_at',
  ],
  beforeSave: function (ticket) {
    const now = clock.isoNow();
    if (!ticket.status) ticket.status = 'open';
    ticket.state = STATE_FOR_STATUS[ticket.status] || ticket.state;
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

Ticket.STATUSES = STATUSES;

/**
 * Change a ticket's status, stamping or clearing closed_at.
 *
 * @param {number} id
 * @param {string} status
 * @param {(err: Error | null, ticket?: any) => void} cb
 */
Ticket.updateStatus = function (id, status, cb) {
  if (STATUSES.indexOf(status) === -1) {
    return setImmediate(cb, new Error('Unknown status: ' + status));
  }
  Ticket.find(id, function (err, ticket) {
    if (err) return cb(err);
    if (!ticket) return cb(null, null);
    if (ticket.status === status) return cb(null, ticket);
    ticket.status = status;
    ticket.closed_at = status === 'closed' ? clock.isoNow() : null;
    ticket.save(function (/** @type {Error | null} */ saveErr) {
      if (saveErr) return cb(saveErr);
      cb(null, ticket);
    });
  });
};

module.exports = Ticket;
