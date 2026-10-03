import { createRequire } from 'node:module';
import { promisify } from 'node:util';

export const require = createRequire(import.meta.url);

const db = require('../db/connection');

export const migrate = promisify(db.migrate);
export const run = promisify(db.run);
export const all = promisify(db.all);

/**
 * @param {string} name
 * @param {string} email
 */
export async function createTeammate(name, email) {
  const Teammate = require('../models/teammate');
  return promisify(Teammate.create)({ name, email, created_at: new Date().toISOString() });
}
