'use strict';

/**
 * Replies.
 *
 * A reply is recorded twice: as an outbound message on the ticket, and as an
 * outbox row addressed to the customer. The subject carries "[#<id>]" so
 * that the customer's answer threads back onto the same ticket.
 */

const config = require('../config');
const clock = require('../lib/clock');
const Customer = require('../models/customer');
const Message = require('../models/message');
const OutboxEntry = require('../models/outbox-entry');
const Teammate = require('../models/teammate');
const Ticket = require('../models/ticket');

/**
 * @param {any} ticket
 */
function replySubject(ticket) {
  const base = /^re:/i.test(ticket.subject) ? ticket.subject : 'Re: ' + ticket.subject;
  return base.indexOf('[#' + ticket.id + ']') === -1 ? base + ' [#' + ticket.id + ']' : base;
}

/**
 * @param {{ ticketId: number, teammateId: number, body: string }} reply
 * @param {(err: Error | null, result?: { message: any, outbox: any } | null) => void} cb
 */
function sendReply(reply, cb) {
  Ticket.find(reply.ticketId, function (err, ticket) {
    if (err) return cb(err);
    if (!ticket) return cb(null, null);
    Teammate.find(reply.teammateId, function (tmErr, teammate) {
      if (tmErr) return cb(tmErr);
      if (!teammate) return cb(new Error('Unknown teammate: ' + reply.teammateId));
      Customer.find(ticket.customer_id, function (custErr, customer) {
        if (custErr) return cb(custErr);
        const now = clock.isoNow();
        Message.create(
          {
            ticket_id: ticket.id,
            direction: 'outbound',
            author_id: teammate.id,
            from_name: teammate.name,
            from_email: config.supportAddress,
            body: reply.body,
            message_id:
              '<fd-' +
              ticket.id +
              '-' +
              Date.now() +
              '-' +
              Math.random().toString(36).slice(2, 8) +
              '@frontdesk.example>',
            sent_at: now,
          },
          function (msgErr, message) {
            if (msgErr) return cb(msgErr);
            OutboxEntry.create(
              {
                ticket_id: ticket.id,
                message_id: message.id,
                to_address: customer.email,
                subject: replySubject(ticket),
                body: reply.body,
                queued_at: now,
              },
              function (outErr, outbox) {
                if (outErr) return cb(outErr);
                ticket.save(function (/** @type {Error | null} */ saveErr) {
                  if (saveErr) return cb(saveErr);
                  cb(null, { message: message, outbox: outbox });
                });
              },
            );
          },
        );
      });
    });
  });
}

module.exports = { sendReply: sendReply, replySubject: replySubject };
