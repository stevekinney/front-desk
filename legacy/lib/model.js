'use strict';

/**
 * A very small active-record layer.
 *
 * We tried two ORMs in 2019 and both wanted to own the schema. This one
 * doesn't: you list the columns, and it reads and writes them.
 *
 *   const Ticket = defineModel({ table: 'tickets', columns: ['subject', ...] });
 *   Ticket.find(1, function (err, ticket) { ... });
 *   ticket.subject = 'Hello';
 *   ticket.save(function (err) { ... });
 */

const db = require('../db/connection');

/**
 * @typedef {Object} ModelSpec
 * @property {string} table
 * @property {string[]} columns  Every column except `id`.
 * @property {(record: any) => void} [beforeSave]
 * @property {(record: any, cb: (err: Error | null) => void) => void} [afterSave]
 */

/**
 * @param {ModelSpec} spec
 */
function defineModel(spec) {
  const table = spec.table;
  const columns = spec.columns;

  /**
   * @constructor
   * @param {Object<string, any>} [attrs]
   */
  function Model(attrs) {
    const self = /** @type {any} */ (this);
    attrs = attrs || {};
    self.id = attrs.id == null ? null : attrs.id;
    columns.forEach(function (column) {
      self[column] = attrs[column] === undefined ? null : attrs[column];
    });
  }

  Model.table = table;
  Model.columns = columns;

  /**
   * @param {any} row
   */
  function hydrate(row) {
    return row ? new /** @type {any} */ (Model)(row) : null;
  }

  /**
   * @param {Object<string, any>} conditions
   * @returns {{ clause: string, params: any[] }}
   */
  function whereClause(conditions) {
    const keys = Object.keys(conditions || {});
    if (keys.length === 0) return { clause: '', params: [] };
    keys.forEach(function (key) {
      if (key !== 'id' && columns.indexOf(key) === -1) {
        throw new Error('Unknown column "' + key + '" on ' + table);
      }
    });
    return {
      clause:
        ' WHERE ' +
        keys
          .map(function (key) {
            return conditions[key] === null ? key + ' IS NULL' : key + ' = ?';
          })
          .join(' AND '),
      params: keys
        .filter(function (key) {
          return conditions[key] !== null;
        })
        .map(function (key) {
          return conditions[key];
        }),
    };
  }

  /**
   * @param {number} id
   * @param {(err: Error | null, record?: any) => void} cb
   */
  Model.find = function (id, cb) {
    db.get('SELECT * FROM ' + table + ' WHERE id = ?', [id], function (err, row) {
      if (err) return cb(err);
      cb(null, hydrate(row));
    });
  };

  /**
   * @param {Object<string, any>} conditions
   * @param {(err: Error | null, records?: any[]) => void} cb
   */
  Model.where = function (conditions, cb) {
    let where;
    try {
      where = whereClause(conditions);
    } catch (err) {
      return setImmediate(cb, err);
    }
    db.all(
      'SELECT * FROM ' + table + where.clause + ' ORDER BY id',
      where.params,
      function (err, rows) {
        if (err) return cb(err);
        cb(null, rows.map(hydrate));
      },
    );
  };

  /**
   * @param {Object<string, any>} conditions
   * @param {(err: Error | null, record?: any) => void} cb
   */
  Model.findOne = function (conditions, cb) {
    Model.where(conditions, function (err, records) {
      if (err) return cb(err);
      cb(null, records && records.length ? records[0] : null);
    });
  };

  /**
   * @param {Object<string, any>} attrs
   * @param {(err: Error | null, record?: any) => void} cb
   */
  Model.create = function (attrs, cb) {
    const record = new /** @type {any} */ (Model)(attrs);
    record.save(function (/** @type {Error | null} */ err) {
      if (err) return cb(err);
      cb(null, record);
    });
  };

  /**
   * Insert or update, depending on whether the record has an id.
   *
   * @this {any}
   * @param {(err: Error | null) => void} cb
   */
  Model.prototype.save = function (cb) {
    const self = this;
    if (spec.beforeSave) spec.beforeSave(self);
    const values = columns.map(function (column) {
      return self[column];
    });

    function done(/** @type {Error | null} */ err) {
      if (err) return cb(err);
      if (spec.afterSave) return spec.afterSave(self, cb);
      cb(null);
    }

    if (self.id == null) {
      const placeholders = columns.map(function () {
        return '?';
      });
      db.run(
        'INSERT INTO ' +
          table +
          ' (' +
          columns.join(', ') +
          ') VALUES (' +
          placeholders.join(', ') +
          ')',
        values,
        function (err, result) {
          if (err) return cb(err);
          self.id = result.lastID;
          done(null);
        },
      );
    } else {
      const assignments = columns.map(function (column) {
        return column + ' = ?';
      });
      db.run(
        'UPDATE ' + table + ' SET ' + assignments.join(', ') + ' WHERE id = ?',
        values.concat([self.id]),
        function (err) {
          done(err);
        },
      );
    }
  };

  /** @this {any} */
  Model.prototype.toJSON = function () {
    const self = this;
    /** @type {Object<string, any>} */
    const out = { id: self.id };
    columns.forEach(function (column) {
      out[column] = self[column];
    });
    return out;
  };

  return Model;
}

module.exports = defineModel;
