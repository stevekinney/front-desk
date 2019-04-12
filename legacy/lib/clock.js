'use strict';

/**
 * Wrapped so tests can freeze time without touching Date globally.
 */

let frozen = null;

module.exports = {
  /** @returns {Date} */
  now: function () {
    return frozen ? new Date(frozen.getTime()) : new Date();
  },
  /** @param {Date | null} date */
  freeze: function (date) {
    frozen = date;
  },
  /** @returns {string} */
  isoNow: function () {
    return module.exports.now().toISOString();
  },
};
