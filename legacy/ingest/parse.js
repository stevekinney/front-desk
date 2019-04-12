'use strict';

/**
 * Turn a file from the inbox into a normalized message.
 *
 * Two formats show up in the inbox:
 *
 *   *.json  Already parsed by the old spool pre-processor. Most mail.
 *   *.eml   Raw RFC 822, parsed here with the vendored mailparse-lite.
 */

const fs = require('fs');
const path = require('path');

const mailparse = require('mailparse-lite');

/**
 * @typedef {Object} ParsedMail
 * @property {string | null} messageId
 * @property {string | null} inReplyTo
 * @property {{ name: string | null, email: string }} from
 * @property {string} subject
 * @property {string | null} date  ISO 8601
 * @property {string} text
 */

const SUPPORTED = ['.json', '.eml'];

/** @param {string} filename */
function isMailFile(filename) {
  return SUPPORTED.indexOf(path.extname(filename).toLowerCase()) !== -1;
}

/**
 * @param {any} data
 * @returns {ParsedMail}
 */
function fromJson(data) {
  const from = data.from || {};
  return {
    messageId: data.messageId || null,
    inReplyTo: data.inReplyTo || null,
    from: { name: from.name || null, email: String(from.email || '').toLowerCase() },
    subject: String(data.subject || '').trim(),
    date: data.date ? new Date(data.date).toISOString() : null,
    text: String(data.text || '').trim(),
  };
}

/**
 * @param {Buffer} raw
 * @returns {ParsedMail}
 */
function fromEml(raw) {
  const mail = mailparse.parse(raw);
  return {
    messageId: mail.messageId,
    inReplyTo: mail.inReplyTo,
    from: {
      name: mail.from ? mail.from.name : null,
      email: mail.from ? mail.from.address.toLowerCase() : '',
    },
    subject: mail.subject.trim(),
    date: mail.date ? mail.date.toISOString() : null,
    text: mail.text,
  };
}

/**
 * @param {string} filePath
 * @param {(err: Error | null, mail?: ParsedMail) => void} cb
 */
function parseFile(filePath, cb) {
  fs.readFile(filePath, function (err, raw) {
    if (err) return cb(err);
    /** @type {ParsedMail} */
    let mail;
    try {
      mail =
        path.extname(filePath).toLowerCase() === '.json'
          ? fromJson(JSON.parse(raw.toString('utf8')))
          : fromEml(raw);
    } catch (parseErr) {
      return cb(
        new Error(
          'Could not parse ' +
            path.basename(filePath) +
            ': ' +
            /** @type {Error} */ (parseErr).message,
        ),
      );
    }
    if (!mail.from.email) return cb(new Error('No sender in ' + path.basename(filePath)));
    if (!mail.subject) mail.subject = '(no subject)';
    cb(null, mail);
  });
}

module.exports = { parseFile: parseFile, isMailFile: isMailFile };
