'use strict';

/**
 * The mailroom's public surface.
 *
 * Everything outside legacy/ should come through here rather than reaching
 * into individual files.
 */

const config = require('./config');
const db = require('./db/connection');
const businessHours = require('./lib/business-hours');
const cache = require('./lib/cache');
const clock = require('./lib/clock');
const drop = require('./lib/drop');
const sla = require('./lib/sla');
const poller = require('./ingest/poller');
const mailer = require('./outbox/mailer');
const Customer = require('./models/customer');
const Message = require('./models/message');
const OutboxEntry = require('./models/outbox-entry');
const Teammate = require('./models/teammate');
const Ticket = require('./models/ticket');
const TicketPause = require('./models/ticket-pause');

module.exports = {
  config: config,
  db: db,
  businessHours: businessHours,
  cache: cache,
  clock: clock,
  drop: drop,
  sla: sla,
  poller: poller,
  mailer: mailer,
  models: {
    Customer: Customer,
    Message: Message,
    OutboxEntry: OutboxEntry,
    Teammate: Teammate,
    Ticket: Ticket,
    TicketPause: TicketPause,
  },
};
