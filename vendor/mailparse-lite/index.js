'use strict';

/**
 * mailparse-lite 0.3.2
 * https://github.com/iokafor/mailparse-lite
 */

var ENCODED_WORD = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

function splitHeadAndBody(raw) {
  var match = /\r?\n\r?\n/.exec(raw);
  if (!match) return { head: raw, body: '' };
  return { head: raw.slice(0, match.index), body: raw.slice(match.index + match[0].length) };
}

function parseHeaders(head) {
  var headers = {};
  var unfolded = head.replace(/\r?\n[ \t]+/g, ' ');
  unfolded.split(/\r?\n/).forEach(function (line) {
    var colon = line.indexOf(':');
    if (colon <= 0) return;
    var name = line.slice(0, colon).trim().toLowerCase();
    var value = line.slice(colon + 1).trim();
    headers[name] = headers[name] ? headers[name] + ', ' + value : value;
  });
  return headers;
}

function qDecodeBytes(text) {
  var bytes = [];
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '_') {
      bytes.push(0x20);
    } else if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(text.substr(i + 1, 2))) {
      bytes.push(parseInt(text.substr(i + 1, 2), 16));
      i += 2;
    } else {
      bytes.push(ch.charCodeAt(0));
    }
  }
  return Buffer.from(bytes);
}

function decodeWords(value) {
  if (!value) return value;
  // front-desk patch 1 (see PATCHES.md): adjacent encoded words are joined
  // without the whitespace between them.
  var joined = value.replace(/(\?=)\s+(=\?)/g, '$1$2');
  return joined.replace(ENCODED_WORD, function (_, charset, encoding, text) {
    var bytes = encoding.toUpperCase() === 'B' ? Buffer.from(text, 'base64') : qDecodeBytes(text);
    // front-desk patch 3 (see PATCHES.md): decode ISO-8859-1 encoded words as Latin-1.
    return bytes.toString(/^iso-8859-1$/i.test(charset) ? 'latin1' : 'utf8');
  });
}

function parseAddress(value) {
  if (!value) return null;
  var decoded = decodeWords(value);
  var angle = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(decoded);
  if (angle) return { name: angle[1].trim() || null, address: angle[2].trim() };
  return { name: null, address: decoded.trim() };
}

function decodeQuotedPrintable(body) {
  var softBreaksRemoved = body.replace(/=\r?\n/g, '');
  var bytes = [];
  for (var i = 0; i < softBreaksRemoved.length; i++) {
    var ch = softBreaksRemoved[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(softBreaksRemoved.substr(i + 1, 2))) {
      bytes.push(parseInt(softBreaksRemoved.substr(i + 1, 2), 16));
      i += 2;
    } else {
      var code = ch.charCodeAt(0);
      if (code < 0x80) bytes.push(code);
      // front-desk patch 2 (see PATCHES.md): keep raw 8-bit characters intact.
      else Buffer.from(ch, 'utf8').forEach(function (b) { bytes.push(b); });
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function decodeBody(headers, body) {
  var encoding = (headers['content-transfer-encoding'] || '').toLowerCase();
  if (encoding === 'quoted-printable') return decodeQuotedPrintable(body);
  if (encoding === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  return body;
}

function boundaryOf(contentType) {
  var match = /boundary="?([^";]+)"?/i.exec(contentType || '');
  return match ? match[1] : null;
}

function textFrom(headers, body) {
  var contentType = (headers['content-type'] || 'text/plain').toLowerCase();
  if (contentType.indexOf('multipart/') === 0) {
    var boundary = boundaryOf(headers['content-type']);
    if (!boundary) return '';
    var parts = body.split('--' + boundary);
    for (var i = 1; i < parts.length; i++) {
      var part = parts[i];
      if (part.indexOf('--') === 0) break;
      var section = splitHeadAndBody(part.replace(/^\r?\n/, ''));
      var partHeaders = parseHeaders(section.head);
      var text = textFrom(partHeaders, section.body);
      if (text) return text;
    }
    return '';
  }
  if (contentType.indexOf('text/plain') !== 0) return '';
  return decodeBody(headers, body);
}

function parse(input) {
  var raw = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  var sections = splitHeadAndBody(raw);
  var headers = parseHeaders(sections.head);
  var date = headers.date ? new Date(headers.date) : null;
  return {
    headers: headers,
    subject: decodeWords(headers.subject || ''),
    from: parseAddress(headers.from),
    to: parseAddress(headers.to),
    date: date && !isNaN(date.getTime()) ? date : null,
    messageId: headers['message-id'] || null,
    inReplyTo: headers['in-reply-to'] || null,
    text: textFrom(headers, sections.body).replace(/\r\n/g, '\n').trim(),
  };
}

module.exports = { parse: parse, decodeWords: decodeWords };
