'use strict';

/**
 * What a rule sees and what it can do.
 *
 * A rule gets a ticket that already carries its customer, its tag names, and
 * the message that woke the rules up (null on the hourly sweep). Changes go
 * through the context, which writes them and updates the ticket in place so
 * the next rule sees them.
 */

const db = require('../db/connection');
const clock = require('../lib/clock');
const Ticket = require('../models/ticket');

/**
 * @typedef {Object} RuleTicket
 * @property {number} id
 * @property {string} subject
 * @property {string} status
 * @property {number | null} assignee_id
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string | null} closed_at
 * @property {{ name: string | null, email: string, vip: boolean }} customer
 * @property {string[]} tags
 * @property {{ direction: string, body: string, created_at: string } | null} message
 */

/**
 * @param {number} ticketId
 * @param {any} message  The message that just arrived, if any.
 * @param {(err: Error | null, ticket?: RuleTicket | null) => void} cb
 */
function loadTicket(ticketId, message, cb) {
  db.get(
    'SELECT t.*, c.name AS customer_name, c.email AS customer_email, c.vip AS customer_vip' +
      ' FROM tickets t JOIN customers c ON c.id = t.customer_id WHERE t.id = ?',
    [ticketId],
    function (err, row) {
      if (err) return cb(err);
      if (!row) return cb(null, null);
      db.all(
        'SELECT g.name FROM ticket_tags tt JOIN tags g ON g.id = tt.tag_id' +
          ' WHERE tt.ticket_id = ? ORDER BY g.name',
        [ticketId],
        function (tagErr, tagRows) {
          if (tagErr) return cb(tagErr);
          cb(null, {
            id: row.id,
            subject: row.subject,
            status: row.status,
            assignee_id: row.assignee_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            closed_at: row.closed_at,
            customer: {
              name: row.customer_name,
              email: row.customer_email,
              vip: row.customer_vip === 1,
            },
            tags: tagRows.map(function (/** @type {any} */ tag) {
              return tag.name;
            }),
            message: message
              ? { direction: message.direction, body: message.body, created_at: message.created_at }
              : null,
          });
        },
      );
    },
  );
}

/**
 * @param {RuleTicket} ticket
 * @param {(err: Error | null, ctx?: any) => void} cb
 */
function createContext(ticket, cb) {
  db.all('SELECT id, name, email FROM teammates ORDER BY id', [], function (err, teammates) {
    if (err) return cb(err);
    cb(null, {
      now: clock.now(),
      teammates: teammates,

      /**
       * @param {string} status
       * @param {(err: Error | null) => void} done
       */
      setStatus: function (status, done) {
        Ticket.updateStatus(ticket.id, status, function (updateErr, updated) {
          if (updateErr) return done(updateErr);
          ticket.status = status;
          ticket.closed_at = updated ? updated.closed_at : ticket.closed_at;
          done(null);
        });
      },

      /**
       * @param {number} teammateId
       * @param {(err: Error | null) => void} done
       */
      assign: function (teammateId, done) {
        Ticket.find(ticket.id, function (findErr, record) {
          if (findErr) return done(findErr);
          record.assignee_id = teammateId;
          record.save(function (/** @type {Error | null} */ saveErr) {
            if (saveErr) return done(saveErr);
            ticket.assignee_id = teammateId;
            done(null);
          });
        });
      },

      /**
       * Tags are managed in the web app; a rule can only use one that exists.
       *
       * @param {string} name
       * @param {(err: Error | null) => void} done
       */
      addTag: function (name, done) {
        db.run(
          'INSERT OR IGNORE INTO ticket_tags (ticket_id, tag_id) SELECT ?, id FROM tags WHERE name = ?',
          [ticket.id, name],
          function (tagErr) {
            if (tagErr) return done(tagErr);
            if (ticket.tags.indexOf(name) === -1) ticket.tags.push(name);
            done(null);
          },
        );
      },

      /** @param {string} line */
      log: function (line) {
        console.log('[rules] ' + line);
      },
    });
  });
}

module.exports = { loadTicket: loadTicket, createContext: createContext };
