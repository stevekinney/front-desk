'use strict';

/**
 * The mailroom's database handle.
 *
 * This module used to wrap the `sqlite3` driver. When the native build kept
 * breaking on new laptops it was switched to `node:sqlite`, but the callback
 * signatures stayed the same so nothing above this file had to change.
 *
 * The connection is opened lazily and then kept for the life of the process.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const config = require('../config');

/** @type {import('node:sqlite').DatabaseSync | null} */
let connection = null;

/**
 * @typedef {(err: Error | null, result?: any) => void} Callback
 */

function open() {
  if (connection) return connection;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  connection = new DatabaseSync(config.dbPath);
  connection.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  connection.function('business_minutes', { deterministic: true }, businessMinutes);
  return connection;
}

/**
 * business_minutes(start, end) in SQL: the business minutes between two ISO
 * timestamps.
 *
 * @param {string | null} start
 * @param {string | null} end
 * @returns {number | null}
 */
function businessMinutes(start, end) {
  if (!start || !end) return null;
  // Required here, not at the top: sla.js loads the models, which load this file.
  const sla = require('../lib/sla');
  return sla.businessMinutesBetween(new Date(start), new Date(end));
}

/**
 * sqlite3 always called back asynchronously. Keep doing that so callers that
 * depend on it (and there are some) keep working.
 *
 * @param {() => any} work
 * @param {Callback} cb
 */
function defer(work, cb) {
  setImmediate(function () {
    let result;
    try {
      result = work();
    } catch (err) {
      return cb(/** @type {Error} */ (err));
    }
    cb(null, result);
  });
}

/**
 * @param {string} sql
 * @param {Array<any>} params
 * @param {Callback} cb  Called with `{ lastID, changes }`.
 */
function run(sql, params, cb) {
  defer(function () {
    const info = open()
      .prepare(sql)
      .run(...params);
    return { lastID: Number(info.lastInsertRowid), changes: Number(info.changes) };
  }, cb);
}

/**
 * @param {string} sql
 * @param {Array<any>} params
 * @param {Callback} cb  Called with the first row, or undefined.
 */
function get(sql, params, cb) {
  defer(function () {
    return open()
      .prepare(sql)
      .get(...params);
  }, cb);
}

/**
 * @param {string} sql
 * @param {Array<any>} params
 * @param {Callback} cb  Called with every row.
 */
function all(sql, params, cb) {
  defer(function () {
    return open()
      .prepare(sql)
      .all(...params);
  }, cb);
}

/**
 * SQLite has no ADD/DROP COLUMN IF EXISTS, so ask the catalog first.
 *
 * @param {any} conn
 * @param {string} table
 * @param {string} column
 * @returns {boolean}
 */
function hasColumn(conn, table, column) {
  return (
    conn.prepare('SELECT 1 FROM pragma_table_info(?) WHERE name = ?').get(table, column) !==
    undefined
  );
}

/**
 * Bring databases created by an older release up to the current shape.
 * schema.sql only creates what is missing; changes to existing tables go here,
 * each guarded so it is safe to run on every startup.
 *
 * @param {any} conn
 */
function upgrade(conn) {
  // FD-10: `state` was folded into `status`. The finance export derives it now.
  if (hasColumn(conn, 'tickets', 'state')) conn.exec('ALTER TABLE tickets DROP COLUMN state');
}

/**
 * Create any missing tables, then upgrade existing ones.
 *
 * @param {Callback} cb
 */
function migrate(cb) {
  fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8', function (err, sql) {
    if (err) return cb(err);
    defer(function () {
      open().exec(sql);
      upgrade(open());
    }, cb);
  });
}

function close() {
  if (connection) {
    connection.close();
    connection = null;
  }
}

module.exports = { run, get, all, migrate, close };
