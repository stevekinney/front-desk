'use strict';

/**
 * Mail in, ticket out.
 *
 * A message joins an existing ticket when its In-Reply-To matches a message
 * we already have, or when its subject carries our "[#123]" token. Anything
 * else opens a new ticket.
 */

const config = require('../config');
const Customer = require('../models/customer');
const Message = require('../models/message');
const Ticket = require('../models/ticket');
const clock = require('../lib/clock');
const rules = require('../rules');

const TICKET_TOKEN = /\[#(\d+)\]/;

/**
 * @typedef {import('./parse').ParsedMail} ParsedMail
 * @typedef {{ ticket: any, message: any, created: boolean }} IngestResult
 */

/**
 * @param {ParsedMail} mail
 * @param {(err: Error | null, ticket?: any) => void} cb
 */
function findThread(mail, cb) {
  if (mail.inReplyTo) {
    return Message.findOne({ message_id: mail.inReplyTo }, function (err, parent) {
      if (err) return cb(err);
      if (parent) return Ticket.find(parent.ticket_id, cb);
      findBySubject(mail, cb);
    });
  }
  findBySubject(mail, cb);
}

/**
 * @param {ParsedMail} mail
 * @param {(err: Error | null, ticket?: any) => void} cb
 */
function findBySubject(mail, cb) {
  const token = TICKET_TOKEN.exec(mail.subject);
  if (!token) return setImmediate(cb, null, null);
  Ticket.find(parseInt(token[1], 10), cb);
}

/**
 * @param {ParsedMail} mail
 * @param {(err: Error | null, result?: IngestResult) => void} cb
 */
function ingest(mail, cb) {
  if (!mail.messageId) return ingestNew(mail, cb);
  // Mail servers redeliver. Same Message-ID, same mail.
  Message.findOne({ message_id: mail.messageId }, function (err, duplicate) {
    if (err) return cb(err);
    if (!duplicate) return ingestNew(mail, cb);
    Ticket.find(duplicate.ticket_id, function (findErr, ticket) {
      if (findErr) return cb(findErr);
      cb(null, { ticket: ticket, message: duplicate, created: false });
    });
  });
}

/**
 * @param {ParsedMail} mail
 * @param {(err: Error | null, result?: IngestResult) => void} cb
 */
function ingestNew(mail, cb) {
  Customer.findOrCreate(mail.from, function (err, customer) {
    if (err) return cb(err);
    findThread(mail, function (threadErr, existing) {
      if (threadErr) return cb(threadErr);
      if (existing && existing.customer_id === customer.id) {
        return addMessage(existing, false);
      }
      Ticket.create(
        {
          subject: mail.subject,
          customer_id: customer.id,
          status: 'open',
          created_at: clock.isoNow(),
        },
        function (createErr, ticket) {
          if (createErr) return cb(createErr);
          addMessage(ticket, true);
        },
      );
    });

    /**
     * @param {any} ticket
     * @param {boolean} created
     */
    function addMessage(ticket, created) {
      Message.create(
        {
          ticket_id: ticket.id,
          direction: 'inbound',
          from_name: mail.from.name,
          from_email: mail.from.email,
          body: mail.text,
          message_id: mail.messageId,
          sent_at: mail.date,
        },
        function (msgErr, message) {
          if (msgErr) return cb(msgErr);
          const result = { ticket: ticket, message: message, created: created };
          if (created) return afterIngest(result, cb);
          // Touch the ticket so it sorts to the top of the inbox.
          ticket.save(function (/** @type {Error | null} */ saveErr) {
            if (saveErr) return cb(saveErr);
            afterIngest(result, cb);
          });
        },
      );
    }
  });
}

/**
 * @param {IngestResult} result
 * @param {(err: Error | null, result?: IngestResult) => void} cb
 */
function afterIngest(result, cb) {
  if (!config.rulesEnabled) return cb(null, result);
  rules.applyTo(result.ticket.id, result.message, function (err) {
    if (err) console.error('[rules] could not run on #' + result.ticket.id + ': ' + err.message);
    cb(null, result);
  });
}

module.exports = { ingest: ingest };
