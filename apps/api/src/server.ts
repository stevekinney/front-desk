import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './database.ts';
import { closeLegacy, migrateLegacy, startMailroom } from './legacy-adapter.ts';

const config = loadConfig();
const db = openDatabase(config.databasePath);
await migrateLegacy();

const polling = await startMailroom();
if (polling) console.log('Mailroom is polling inbox/');

const server = createApp(db).listen(config.port, () => {
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
