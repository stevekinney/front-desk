'use strict';

/**
 * The mailroom's database handle.
 *
 * A thin wrapper around the `sqlite3` driver, so that nothing above this file
 * depends on the driver's API.
 *
 * The connection is opened lazily and then kept for the life of the process.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const config = require('../config');

/** @type {import('sqlite3').Database | null} */
let connection = null;

/**
 * @typedef {(err: Error | null, result?: any) => void} Callback
 */

function open() {
  if (connection) return connection;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  connection = new sqlite3.Database(config.dbPath);
  connection.configure('busyTimeout', 5000);
  connection.run('PRAGMA journal_mode = WAL');
  return connection;
}

/**
 * @param {string} sql
 * @param {Array<any>} params
 * @param {Callback} cb  Called with `{ lastID, changes }`.
 */
function run(sql, params, cb) {
  open().run(sql, params, function (err) {
    if (err) return cb(err);
    cb(null, { lastID: this.lastID, changes: this.changes });
  });
}

/**
 * @param {string} sql
 * @param {Array<any>} params
 * @param {Callback} cb  Called with the first row, or undefined.
 */
function get(sql, params, cb) {
  open().get(sql, params, cb);
}

/**
 * @param {string} sql
 * @param {Array<any>} params
 * @param {Callback} cb  Called with every row.
 */
function all(sql, params, cb) {
  open().all(sql, params, cb);
}

/**
 * Create any missing tables.
 *
 * @param {Callback} cb
 */
function migrate(cb) {
  fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8', function (err, sql) {
    if (err) return cb(err);
    open().exec(sql, cb);
  });
}

function close() {
  if (connection) {
    connection.close();
    connection = null;
  }
}

module.exports = { run, get, all, migrate, close };
