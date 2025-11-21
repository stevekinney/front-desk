import path from 'node:path';

export interface ApiConfig {
  port: number;
  databasePath: string;
}

/**
 * The legacy mailroom resolves the same FRONT_DESK_DB variable on its own, so
 * both sides open the same file as long as they share a working directory.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: Number(env.PORT ?? 4100),
    databasePath: path.resolve(env.FRONT_DESK_DB ?? 'data/front-desk.db'),
  };
}
