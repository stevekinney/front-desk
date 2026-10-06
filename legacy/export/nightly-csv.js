#!/usr/bin/env node
'use strict';

/**
 * Nightly export of the tickets resolved on one day.
 *
 *   node legacy/export/nightly-csv.js              yesterday, in the desk's time zone
 *   node legacy/export/nightly-csv.js 2026-10-05   a particular day
 *
 * Writes <exportDir>/resolved-<day>.csv. The file is picked up at 06:00 by
 * the finance team's import (issue #142), which matches on the column names
 * and on the `state` values. There is no `state` column any more; it is
 * derived from `status` here, so leave the names and values alone. Runs from cron; see ops/crontab.
 */

const fs = require('fs');
const path = require('path');

const config = require('../config');
const db = require('../db/connection');
const businessHours = require('../lib/business-hours');

const COLUMNS = [
  'ticket_id',
  'customer_email',
  'customer_name',
  'subject',
  'state',
  'opened_at',
  'resolved_at',
  'business_minutes',
];

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.sla.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The calendar day an instant falls on at the desk, as YYYY-MM-DD.
 *
 * @param {Date} date
 */
function deskDay(date) {
  return dayFormat.format(date);
}

/** @param {any} value */
function csvField(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/**
 * @param {string} day  YYYY-MM-DD
 * @param {(err: Error | null, file?: string, count?: number) => void} cb
 */
function exportDay(day, cb) {
  db.all(
    'SELECT t.id, c.email, c.name, t.subject,' +
      " CASE t.status WHEN 'open' THEN 'active' WHEN 'pending' THEN 'on_hold'" +
      " WHEN 'closed' THEN 'resolved' END AS state, t.created_at, t.closed_at," +
      ' r.business_minutes' +
      ' FROM tickets t' +
      ' JOIN customers c ON c.id = t.customer_id' +
      ' JOIN sla_report r ON r.ticket_id = t.id' +
      " WHERE t.status = 'closed' AND t.closed_at IS NOT NULL" +
      ' ORDER BY t.closed_at, t.id',
    [],
    function (err, rows) {
      if (err) return cb(err);
      const lines = [COLUMNS.join(',')];
      let count = 0;
      rows.forEach(function (/** @type {any} */ row) {
        if (deskDay(new Date(row.closed_at)) !== day) return;
        count += 1;
        lines.push(
          [
            row.id,
            row.email,
            row.name,
            row.subject,
            row.state,
            row.created_at,
            row.closed_at,
            row.business_minutes,
          ]
            .map(csvField)
            .join(','),
        );
      });
      const file = path.join(config.exportDir, 'resolved-' + day + '.csv');
      fs.mkdir(config.exportDir, { recursive: true }, function (mkdirErr) {
        if (mkdirErr) return cb(mkdirErr);
        fs.writeFile(file, lines.join('\r\n') + '\r\n', function (writeErr) {
          if (writeErr) return cb(writeErr);
          cb(null, file, count);
        });
      });
    },
  );
}

module.exports = { exportDay: exportDay, deskDay: deskDay };

if (require.main === module) {
  const arg = process.argv[2];
  if (arg && !/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
    console.error('usage: nightly-csv.js [YYYY-MM-DD]');
    process.exit(2);
  }
  const day = arg || deskDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
  // This process doesn't share memory with the API, so business_minutes needs the saved hours.
  businessHours.load(function (loadErr) {
    if (loadErr) {
      db.close();
      console.error('[export] ' + loadErr.message);
      process.exitCode = 1;
      return;
    }
    runExport(day);
  });
}

/** @param {string} day */
function runExport(day) {
  exportDay(day, function (err, file, count) {
    db.close();
    if (err) {
      console.error('[export] ' + err.message);
      process.exitCode = 1;
      return;
    }
    console.log('[export] ' + count + ' tickets resolved on ' + day + ' -> ' + file);
  });
}
