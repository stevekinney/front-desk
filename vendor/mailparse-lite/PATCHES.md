# Local patches

This directory is mailparse-lite 0.3.2, copied from npm in 2019 so that we
could change it. Upstream was archived in 2021 and 0.3.2 was its last release,
so there is nothing to upgrade to. We still keep the list below, so anyone
who replaces the parser knows what we depend on.

If a change to this copy isn't listed here, it shouldn't be in the copy. Each
patch is marked in `index.js` with a `front-desk patch N` comment.

## 1. Join adjacent encoded words (2019-06)

`decodeWords` in 0.3.2 kept the whitespace between two encoded words, so a
long subject that a mail client had split in two came out with a stray space
in the middle of a word. RFC 2047 says that whitespace should be dropped. The
patch removes it before decoding.

Upstream pull request: iokafor/mailparse-lite#14 (never merged).

## 2. Keep raw 8-bit characters in quoted-printable bodies (2020-02)

Some senders put raw UTF-8 into a body that is declared quoted-printable.
0.3.2 took the low byte of each character's code point, so "é" came out as
garbage. The patch encodes those characters back to their UTF-8 bytes before
decoding.

## Before adding a patch

Every patch here has to be carried by hand forever, and nobody upstream will
review it. If the parser doesn't handle some input, prefer dealing with it in
the mailroom, before or after the call to `parse` (see
`legacy/ingest/parse.js`). Only patch this copy when that isn't possible, and
add an entry above when you do.
