'use strict';

/**
 * Watches the inbox directory and ingests anything new.
 *
 * Files are never moved or deleted. The poller remembers what it has seen in
 * the mailroom_seen table, so a file is only ingested once per database.
 */

const fs = require('fs');
const path = require('path');

const config = require('../config');
const db = require('../db/connection');
const clock = require('../lib/clock');
const parse = require('./parse');
const ingest = require('./ingest');

/** @type {NodeJS.Timeout | null} */
let timer = null;
let polling = false;

/**
 * @typedef {{ filename: string, ticketId: number, created: boolean }} Delivery
 */

/**
 * @param {string} filename
 * @param {(err: Error | null, delivery?: Delivery) => void} cb
 */
function deliver(filename, cb) {
  parse.parseFile(path.join(config.inboxDir, filename), function (err, mail) {
    if (err) return cb(err);
    ingest.ingest(/** @type {any} */ (mail), function (ingestErr, result) {
      if (ingestErr) return cb(ingestErr);
      const ticketId = result.ticket.id;
      db.run(
        'INSERT INTO mailroom_seen (filename, ticket_id, ingested_at) VALUES (?, ?, ?)',
        [filename, ticketId, clock.isoNow()],
        function (seenErr) {
          if (seenErr) return cb(seenErr);
          cb(null, { filename: filename, ticketId: ticketId, created: result.created });
        },
      );
    });
  });
}

/**
 * Ingest every unseen file in the inbox, oldest name first.
 *
 * @param {(err: Error | null, deliveries?: Delivery[]) => void} cb
 */
function pollOnce(cb) {
  if (polling) return setImmediate(cb, null, []);
  polling = true;

  function finish(/** @type {Error | null} */ err, /** @type {Delivery[]} */ deliveries) {
    polling = false;
    cb(err, deliveries);
  }

  fs.readdir(config.inboxDir, function (err, entries) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT')
      return finish(null, []);
    if (err) return finish(err, []);
    db.all('SELECT filename FROM mailroom_seen', [], function (seenErr, rows) {
      if (seenErr) return finish(seenErr, []);
      /** @type {Object<string, boolean>} */
      const seen = {};
      rows.forEach(function (/** @type {any} */ row) {
        seen[row.filename] = true;
      });
      const pending = entries.filter(function (name) {
        return parse.isMailFile(name) && !seen[name];
      });
      pending.sort();

      /** @type {Delivery[]} */
      const deliveries = [];
      (function next(i) {
        if (i >= pending.length) return finish(null, deliveries);
        deliver(/** @type {string} */ (pending[i]), function (deliverErr, delivery) {
          if (deliverErr) {
            console.error('[mailroom] skipping ' + pending[i] + ': ' + deliverErr.message);
          } else if (delivery) {
            deliveries.push(delivery);
          }
          next(i + 1);
        });
      })(0);
    });
  });
}

/**
 * Start polling.
 *
 * @param {(err: Error | null) => void} cb
 */
function start(cb) {
  if (timer) return setImmediate(cb, null);
  timer = setInterval(function () {
    pollOnce(function (err, deliveries) {
      if (err) return console.error('[mailroom] poll failed: ' + err.message);
      (deliveries || []).forEach(function (d) {
        console.log('[mailroom] ' + d.filename + ' -> ticket #' + d.ticketId);
      });
    });
  }, config.pollIntervalMs);
  cb(null);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { pollOnce: pollOnce, start: start, stop: stop };
