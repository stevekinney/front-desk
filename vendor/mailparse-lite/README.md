# mailparse-lite

Parse an RFC 822 message into headers and a plain-text body.

```js
var mailparse = require('mailparse-lite');
var mail = mailparse.parse(fs.readFileSync('message.eml'));

mail.subject; // decoded Subject header
mail.from; // { name: 'Ada', address: 'ada@example.com' }
mail.text; // first text/plain part
```

## What it handles

- Folded (multi-line) headers
- Encoded words in headers (`=?UTF-8?B?...?=` and `=?UTF-8?Q?...?=`)
- `quoted-printable` and `base64` bodies
- `multipart/*` messages: returns the first `text/plain` part

## What it doesn't

- Character sets other than UTF-8 and US-ASCII
- Attachments
- HTML-only messages (you get an empty `text`)

If you need those, use a full parser.
