'use strict';

const defineModel = require('../lib/model');

/**
 * The desk's business hours. There is only ever one row, with id 1.
 */
const BusinessHours = defineModel({
  table: 'business_hours',
  columns: ['open_hour', 'close_hour', 'time_zone', 'sla_hours'],
});

module.exports = BusinessHours;
