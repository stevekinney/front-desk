// Remove the throwaway desk that playwright.config.ts made for this run.
import { rmSync } from 'node:fs';

export default function teardown(): void {
  const dir = process.env.FRONT_DESK_E2E_DIR;
  if (dir) rmSync(dir, { recursive: true, force: true });
}
