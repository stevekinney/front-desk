'use strict';

const defineModel = require('../lib/model');

/**
 * A reply waiting to go out.
 */
const OutboxEntry = defineModel({
  table: 'outbox',
  columns: ['ticket_id', 'message_id', 'to_address', 'subject', 'body', 'queued_at', 'sent_at'],
});

module.exports = OutboxEntry;
