'use strict';

const defineModel = require('../lib/model');
const clock = require('../lib/clock');

/**
 * Whoever wrote in. Customers are keyed by email address.
 */
const Customer = defineModel({
  table: 'customers',
  columns: ['name', 'email', 'vip', 'created_at'],
  beforeSave: function (customer) {
    if (customer.vip == null) customer.vip = 0;
    if (!customer.created_at) customer.created_at = clock.isoNow();
  },
});

/**
 * @param {{ name?: string | null, email: string }} from
 * @param {(err: Error | null, customer?: any) => void} cb
 */
Customer.findOrCreate = function (from, cb) {
  const email = String(from.email).trim().toLowerCase();
  Customer.findOne({ email: email }, function (err, existing) {
    if (err) return cb(err);
    if (existing) {
      if (!existing.name && from.name) {
        existing.name = from.name;
        return existing.save(function (/** @type {Error | null} */ saveErr) {
          cb(saveErr, existing);
        });
      }
      return cb(null, existing);
    }
    Customer.create({ name: from.name || null, email: email }, cb);
  });
};

module.exports = Customer;
