// Covers the vendored parser's header decoding, including the ISO-8859-1 patch.
import { describe, expect, it } from 'vitest';

import { require } from './helpers.js';

const { decodeWords, parse } = require('mailparse-lite');

const SUBJECT = 'Épreuves des cartes de visite : délai de livraison?';
const Q = '=?ISO-8859-1?Q?=C9preuves_des_cartes_de_visite_:_d=E9lai_de_livraison=3F?=';

describe('decodeWords', () => {
  it('decodes ISO-8859-1 Q words', () => {
    expect(decodeWords(Q)).toBe(SUBJECT);
  });

  it('matches the charset label case-insensitively', () => {
    expect(decodeWords(Q.replace('ISO-8859-1?Q', 'iso-8859-1?q'))).toBe(SUBJECT);
    expect(decodeWords('=?iso-8859-1?q?d=E9lai?=')).toBe('délai');
  });

  it('decodes ISO-8859-1 B words', () => {
    const b64 = Buffer.from(SUBJECT, 'latin1').toString('base64');
    expect(decodeWords(`=?ISO-8859-1?B?${b64}?=`)).toBe(SUBJECT);
  });

  it('mixes encoded words with plain text', () => {
    expect(decodeWords('Re: =?ISO-8859-1?Q?d=E9lai?= urgent')).toBe('Re: délai urgent');
  });

  it('leaves UTF-8 and ASCII alone', () => {
    expect(decodeWords('=?UTF-8?Q?Caf=C3=A9?=')).toBe('Café');
    expect(decodeWords(`=?UTF-8?B?${Buffer.from('Café — menu').toString('base64')}?=`)).toBe(
      'Café — menu',
    );
    expect(decodeWords('Plain subject')).toBe('Plain subject');
  });
});

describe('parse', () => {
  it('unfolds and decodes a folded Latin-1 subject', () => {
    const mail = parse(
      [
        'From: =?ISO-8859-1?Q?Ren=E9e_Doub=E9?= <renee@example.com>'.replace('Doub', 'Dub'),
        'Subject: =?ISO-8859-1?Q?Devis_pour_une_r=E9impression_d=27affiches?=',
        'To: desk@example.com',
        '',
        'Body',
      ].join('\r\n'),
    );
    expect(mail.subject).toBe("Devis pour une réimpression d'affiches");
    expect(mail.from.name).toBe('Renée Dubé');

    const folded = parse(
      [
        'Subject: =?ISO-8859-1?Q?Devis_pour_une_r=E9impression_?=',
        ' =?ISO-8859-1?Q?d=27affiches?=',
        '',
        'x',
      ].join('\r\n'),
    );
    expect(folded.subject).toBe("Devis pour une réimpression d'affiches");
  });
});
