#!/usr/bin/env node
'use strict';

/**
 * Usage: mail-drop <fixture>
 *
 * Copies a sample message into the inbox. A running mailroom picks it up on
 * its next poll.
 */

const path = require('path');

const config = require('../config');
const drop = require('../lib/drop');

const name = process.argv[2];

if (!name) {
  drop.listFixtures(function (err, names) {
    console.error('Usage: npm run mail:drop -- <fixture>\n');
    if (err) {
      console.error('Could not read ' + config.fixturesDir + ': ' + err.message);
    } else {
      console.error('Fixtures in ' + path.relative(process.cwd(), config.fixturesDir) + ':');
      (names || []).forEach(function (n) {
        console.error('  ' + n.replace(/\.(json|eml)$/, ''));
      });
    }
    process.exit(1);
  });
} else {
  drop.dropFixture(name, function (err, filename) {
    if (err) {
      console.error(err.message);
      process.exit(1);
    }
    console.log(
      'Dropped ' +
        filename +
        ' into ' +
        path.relative(process.cwd(), config.inboxDir) +
        '/. ' +
        'The mailroom picks it up on its next poll.',
    );
  });
}
