import { existsSync } from 'node:fs';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './database.ts';
import { closeLegacy, migrateLegacy, startMailroom } from './legacy-adapter.ts';
import { seedDatabase } from './seed/seed.ts';

const config = loadConfig();
const isNewDatabase = !existsSync(config.databasePath);
const db = openDatabase(config.databasePath);

if (isNewDatabase) {
  const count = await seedDatabase(db);
  console.log(`Seeded ${count} tickets into ${config.databasePath}`);
} else {
  await migrateLegacy();
}

const polling = await startMailroom();
if (polling) console.log('Mailroom is polling inbox/');

const server = createApp(db).listen(config.port, (error?: Error) => {
  if (error) {
    console.error(`Front Desk API couldn't listen on port ${config.port}: ${error.message}`);
    closeLegacy();
    db.close();
    process.exit(1);
  }
  console.log(`Front Desk API listening on http://localhost:${config.port}`);
});

function shutdown(): void {
  server.close();
  closeLegacy();
  db.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
