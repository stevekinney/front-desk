'use strict';

/**
 * Mailroom configuration.
 *
 * Everything here is read once, when this file is first required. Changing
 * process.env afterwards has no effect on a running process.
 */

const path = require('path');

const env = process.env;

/**
 * @typedef {Object} SlaConfig
 * @property {number} hours      Business hours a ticket has before it breaches.
 * @property {number} openHour   First business hour of the day (24h clock).
 * @property {number} closeHour  Hour the support desk closes (24h clock).
 * @property {string} timeZone   IANA zone the support desk works in.
 */

module.exports = {
  /** SQLite database shared with the desk app. */
  dbPath: path.resolve(env.FRONT_DESK_DB || 'data/front-desk.db'),

  /** The spool directory the poller reads. Relative to the working directory. */
  inboxDir: path.resolve(env.MAILROOM_INBOX || 'inbox'),

  /** How often the poller checks the inbox. */
  pollIntervalMs: parseInt(env.MAILROOM_POLL_MS || '2000', 10),

  /** The address customers write to and replies come from. */
  supportAddress: env.SUPPORT_ADDRESS || 'help@frontdesk.example',

  /** @type {SlaConfig} */
  sla: {
    hours: 8,
    openHour: 9,
    closeHour: 17,
    timeZone: 'America/New_York',
  },
};
