'use strict';

/**
 * Put a sample message into the inbox, as if it had just arrived.
 */

const fs = require('fs');
const path = require('path');

const config = require('../config');
const parse = require('../ingest/parse');

/**
 * Find a fixture by name ("refund-request"), file name ("refund-request.json"),
 * or path.
 *
 * @param {string} name
 * @returns {string | null}
 */
function resolveFixture(name) {
  const candidates = [
    path.resolve(name),
    path.join(config.fixturesDir, name),
    path.join(config.fixturesDir, name + '.json'),
    path.join(config.fixturesDir, name + '.eml'),
  ];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = /** @type {string} */ (candidates[i]);
    if (
      parse.isMailFile(candidate) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * @param {(err: Error | null, names?: string[]) => void} cb
 */
function listFixtures(cb) {
  fs.readdir(config.fixturesDir, function (err, entries) {
    if (err) return cb(err);
    cb(null, entries.filter(parse.isMailFile).sort());
  });
}

/**
 * @param {string} name
 * @param {(err: Error | null, filename?: string) => void} cb
 */
function dropFixture(name, cb) {
  const source = resolveFixture(name);
  if (!source)
    return setImmediate(cb, new Error('No fixture named "' + name + '" in ' + config.fixturesDir));
  const filename = 'drop-' + Date.now() + '-' + path.basename(source);
  fs.mkdir(config.inboxDir, { recursive: true }, function (mkErr) {
    if (mkErr) return cb(mkErr);
    fs.copyFile(source, path.join(config.inboxDir, filename), function (err) {
      if (err) return cb(err);
      cb(null, filename);
    });
  });
}

module.exports = {
  dropFixture: dropFixture,
  listFixtures: listFixtures,
  resolveFixture: resolveFixture,
};
