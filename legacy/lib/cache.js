'use strict';

/**
 * Process-wide memo cache.
 *
 * Shared by everything that requires it, because Node only loads a module
 * once. Entries never expire on their own; whoever changes the underlying
 * data is responsible for calling `del`.
 */

/** @type {Map<string, any>} */
const store = new Map();

module.exports = {
  /** @param {string} key */
  get: function (key) {
    return store.get(key);
  },
  /**
   * @param {string} key
   * @param {any} value
   */
  set: function (key, value) {
    store.set(key, value);
    return value;
  },
  /** @param {string} key */
  del: function (key) {
    store.delete(key);
  },
  /** @param {string} prefix */
  delPrefix: function (prefix) {
    Array.from(store.keys()).forEach(function (key) {
      if (key.indexOf(prefix) === 0) store.delete(key);
    });
  },
  clear: function () {
    store.clear();
  },
  size: function () {
    return store.size;
  },
};
