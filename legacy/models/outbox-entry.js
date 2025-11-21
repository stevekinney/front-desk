'use strict';

const defineModel = require('../lib/model');

/**
 * A reply waiting to go out. Nothing drains this table any more; the desk app
 * reads it to show that a reply was sent.
 */
const OutboxEntry = defineModel({
  table: 'outbox',
  columns: ['ticket_id', 'message_id', 'to_address', 'subject', 'body', 'queued_at', 'sent_at'],
});

module.exports = OutboxEntry;
