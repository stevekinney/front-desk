'use strict';

/**
 * The desk's current business hours.
 *
 * The SLA math is synchronous (it also runs inside the `business_minutes` SQL
 * function), so the saved row is loaded into memory first and `get` reads it
 * from there. `config.sla` supplies the defaults until something is loaded.
 */

const config = require('../config');
const cache = require('./cache');
const BusinessHours = require('../models/business-hours');

/**
 * @typedef {Object} BusinessHoursSettings
 * @property {number} openHour
 * @property {number} closeHour
 * @property {string} timeZone
 * @property {number} slaHours
 */

/** @type {BusinessHoursSettings | null} */
let current = null;

/** @returns {BusinessHoursSettings} */
function defaults() {
  return {
    openHour: config.sla.openHour,
    closeHour: config.sla.closeHour,
    timeZone: config.sla.timeZone,
    slaHours: config.sla.hours,
  };
}

/** @returns {BusinessHoursSettings} */
function get() {
  return current || defaults();
}

function isLoaded() {
  return current !== null;
}

/** @param {any} row */
function fromRow(row) {
  return {
    openHour: row.open_hour,
    closeHour: row.close_hour,
    timeZone: row.time_zone,
    slaHours: row.sla_hours,
  };
}

/**
 * Read the saved row into memory. Keeps the defaults if the row is missing.
 *
 * @param {(err: Error | null, settings?: BusinessHoursSettings) => void} cb
 */
function load(cb) {
  BusinessHours.find(1, function (err, row) {
    if (err) return cb(err);
    current = row ? fromRow(row) : defaults();
    cb(null, current);
  });
}

/**
 * Save new settings, then drop every cached SLA, because each holds a due
 * time computed under the old ones.
 *
 * @param {BusinessHoursSettings} attrs
 * @param {(err: Error | null, settings?: BusinessHoursSettings) => void} cb
 */
function save(attrs, cb) {
  BusinessHours.find(1, function (err, row) {
    if (err) return cb(err);
    if (!row) return cb(new Error('The business_hours row is missing; run the migration'));
    const record = row;
    record.open_hour = attrs.openHour;
    record.close_hour = attrs.closeHour;
    record.time_zone = attrs.timeZone;
    record.sla_hours = attrs.slaHours;
    record.save(function (/** @type {Error | null} */ saveErr) {
      if (saveErr) return cb(saveErr);
      current = fromRow(record);
      cache.delPrefix('sla:');
      cb(null, current);
    });
  });
}

/** Forget what was loaded. For tests. */
function reset() {
  current = null;
  cache.delPrefix('sla:');
}

module.exports = { get, isLoaded, load, save, reset };
