#!/usr/bin/env node
'use strict';

/**
 * Run the automation rules over every ticket that isn't closed.
 *
 * Mail arriving runs the rules for its own ticket. Some rules care about time
 * passing instead (auto-close-stale), so cron runs this every hour. See
 * ops/crontab.
 */

const db = require('../db/connection');
const rules = require('../rules');

db.all("SELECT id FROM tickets WHERE state <> 'resolved' ORDER BY id", [], function (err, rows) {
  if (err) {
    console.error('[sweep] ' + err.message);
    process.exitCode = 1;
    return db.close();
  }
  (function next(i) {
    if (i >= rows.length) {
      console.log('[sweep] checked ' + rows.length + ' tickets');
      return db.close();
    }
    rules.applyTo(rows[i].id, null, function (applyErr) {
      if (applyErr) console.error('[sweep] #' + rows[i].id + ': ' + applyErr.message);
      next(i + 1);
    });
  })(0);
});
