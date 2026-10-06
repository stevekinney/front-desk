/**
 * How `check` and `smoke` order the unit tests.
 *
 *   --seed <n>    shuffle with this seed (also read from TEST_SEED)
 *   --shuffle     shuffle with a random seed
 *   --no-shuffle  default order
 *
 * Shuffling uses Vitest's `--sequence.shuffle --sequence.seed=<n>`, so any
 * order can be replayed from its seed.
 */
export interface TestOrder {
  seed: number | null;
  /** Arguments to pass to `vitest run`. */
  args: string[];
  /** One line that says how the tests were ordered and how to replay it. */
  describe(): string;
}

export function parseTestOrder(argv: string[], options: { shuffleByDefault: boolean }): TestOrder {
  let seed: number | null = null;
  let shuffle = options.shuffleByDefault;

  const fromEnv = process.env.TEST_SEED;
  if (fromEnv) {
    seed = Number(fromEnv);
    shuffle = true;
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--shuffle') shuffle = true;
    else if (arg === '--no-shuffle') shuffle = false;
    else if (arg === '--seed') {
      seed = Number(argv[i + 1]);
      shuffle = true;
      i += 1;
    } else if (arg?.startsWith('--seed=')) {
      seed = Number(arg.slice('--seed='.length));
      shuffle = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (seed !== null && !Number.isSafeInteger(seed)) throw new Error('The seed must be an integer');
  if (shuffle && seed === null) seed = Math.floor(Math.random() * 100_000) + 1;
  if (!shuffle) seed = null;

  return {
    seed,
    args: seed === null ? [] : ['--sequence.shuffle', `--sequence.seed=${seed}`],
    describe() {
      return seed === null
        ? 'Test order: default (declaration) order'
        : `Test order: shuffled, seed ${seed} (replay this order with \`-- --seed ${seed}\` or TEST_SEED=${seed})`;
    },
  };
}
