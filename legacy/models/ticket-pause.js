'use strict';

const defineModel = require('../lib/model');
const cache = require('../lib/cache');

/**
 * A stretch of time a ticket spent pending. The SLA clock is paused for it.
 */
const TicketPause = defineModel({
  table: 'ticket_pauses',
  columns: ['ticket_id', 'started_at', 'ended_at'],
  afterSave: function (pause, cb) {
    cache.del('sla:' + pause.ticket_id);
    cb(null);
  },
});

module.exports = TicketPause;
