'use strict';

const defineModel = require('../lib/model');
const clock = require('../lib/clock');

/**
 * One email on a ticket. direction is "inbound" (from the customer) or
 * "outbound" (a teammate's reply).
 */
const Message = defineModel({
  table: 'messages',
  columns: [
    'ticket_id',
    'direction',
    'author_id',
    'from_name',
    'from_email',
    'body',
    'message_id',
    'sent_at',
    'created_at',
  ],
  beforeSave: function (message) {
    if (!message.created_at) message.created_at = clock.isoNow();
  },
});

module.exports = Message;
