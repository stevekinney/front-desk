# Local patches

This directory is mailparse-lite 0.3.2, copied from npm so that we could
change it. Keep the list below up to date, so anyone who upgrades or replaces
the parser knows what we depend on.

If a change to this copy isn't listed here, it shouldn't be in the copy. Each
patch is marked in `index.js` with a `front-desk patch N` comment.

## 1. Join adjacent encoded words (2019-06)

`decodeWords` in 0.3.2 kept the whitespace between two encoded words, so a
long subject that a mail client had split in two came out with a stray space
in the middle of a word. RFC 2047 says that whitespace should be dropped. The
patch removes it before decoding.

Upstream pull request: iokafor/mailparse-lite#14.
