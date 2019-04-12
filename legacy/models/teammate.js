'use strict';

const defineModel = require('../lib/model');

/**
 * Someone on the support team.
 */
const Teammate = defineModel({
  table: 'teammates',
  columns: ['name', 'email', 'created_at'],
});

module.exports = Teammate;
