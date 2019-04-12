#!/usr/bin/env node
'use strict';

/**
 * Usage: mailroom
 *
 * Creates any missing tables, then polls the inbox until it is stopped.
 */

const config = require('../config');
const db = require('../db/connection');
const poller = require('../ingest/poller');

db.migrate(function (err) {
  if (err) {
    console.error('[mailroom] ' + err.message);
    process.exit(1);
  }
  poller.start(function (startErr) {
    if (startErr) {
      console.error('[mailroom] ' + startErr.message);
      process.exit(1);
    }
    console.log('[mailroom] polling ' + config.inboxDir);
  });
});

process.on('SIGTERM', function () {
  poller.stop();
  db.close();
  process.exit(0);
});
