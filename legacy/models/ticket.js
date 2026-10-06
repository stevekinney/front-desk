'use strict';

const defineModel = require('../lib/model');
const cache = require('../lib/cache');
const clock = require('../lib/clock');
const TicketPause = require('./ticket-pause');

const STATUSES = ['open', 'pending', 'closed'];

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
    'created_at',
    'updated_at',
    'closed_at',
  ],
  beforeSave: function (ticket) {
    const now = clock.isoNow();
    if (!ticket.status) ticket.status = 'open';
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
    const now = clock.isoNow();
    const wasPending = ticket.status === 'pending';
    ticket.status = status;
    ticket.closed_at = status === 'closed' ? now : null;

    function saveTicket() {
      ticket.save(function (/** @type {Error | null} */ saveErr) {
        if (saveErr) return cb(saveErr);
        cb(null, ticket);
      });
    }

    // The pause is written first so the ticket's own afterSave clears the
    // cached SLA last.
    if (status === 'pending') {
      return TicketPause.create({ ticket_id: id, started_at: now }, function (pauseErr) {
        if (pauseErr) return cb(pauseErr);
        saveTicket();
      });
    }
    if (!wasPending) return saveTicket();
    TicketPause.findOne({ ticket_id: id, ended_at: null }, function (findErr, pause) {
      if (findErr) return cb(findErr);
      if (!pause) return saveTicket();
      pause.ended_at = now;
      pause.save(function (/** @type {Error | null} */ pauseErr) {
        if (pauseErr) return cb(pauseErr);
        saveTicket();
      });
    });
  });
};

module.exports = Ticket;
