import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createDesk, repositoryRoot, type Desk } from './support/desk.ts';

let desk: Desk;
let counter = 0;

beforeAll(async () => {
  desk = await createDesk();
});

/** A raw message as a mail server would hand it over, headers byte for byte. */
function eml(headers: { from: string; subject: string }): Buffer {
  counter += 1;
  return Buffer.from(
    [
      `From: ${headers.from}`,
      'To: help@frontdesk.example',
      `Subject: ${headers.subject}`,
      'Date: Tue, 6 Oct 2026 10:12:00 -0400',
      `Message-ID: <fd02-${counter}@mail.example>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="us-ascii"',
      '',
      'Hello, please see the subject line.',
      '',
    ].join('\r\n'),
    'latin1',
  );
}

const latin1Base64 = (text: string): string => Buffer.from(text, 'latin1').toString('base64');

async function ticketFor(
  contents: Buffer,
): Promise<{ subject: string; customer: { name: string } }> {
  counter += 1;
  const id = await desk.deliverFile(`fd02-${counter}.eml`, contents);
  const res = await desk.get(`/api/tickets/${id}`).expect(200);
  return res.body as { subject: string; customer: { name: string } };
}

describe('FD-02: Latin-1 headers', () => {
  it('decodes a quoted-printable ISO-8859-1 subject (1)', async () => {
    const ticket = await ticketFor(
      eml({
        from: 'Mathilde Roy <m.roy@example.com>',
        subject: '=?ISO-8859-1?Q?Probl=E8me_de_fa=E7onnage?=',
      }),
    );
    expect(ticket.subject).toBe('Problème de façonnage');
  });

  it('decodes a base64 ISO-8859-1 subject, whatever the charset label case (1)', async () => {
    const ticket = await ticketFor(
      eml({
        from: 'Luc Morin <luc@example.com>',
        subject: `=?iso-8859-1?B?${latin1Base64('Facture n° 4471 : TVA incorrecte')}?=`,
      }),
    );
    expect(ticket.subject).toBe('Facture n° 4471 : TVA incorrecte');
  });

  it('decodes encoded words mixed with plain text and split across lines (1)', async () => {
    const ticket = await ticketFor(
      eml({
        from: 'Ana Sousa <ana@example.com>',
        subject:
          'Re: =?ISO-8859-1?Q?caf=E9?= menus and =?ISO-8859-1?Q?cr=E8me_?=\r\n =?ISO-8859-1?Q?br=FBl=E9e?= cards',
      }),
    );
    expect(ticket.subject).toBe('Re: café menus and crème brûlée cards');
  });

  it("decodes the sender's display name the same way (2)", async () => {
    const ticket = await ticketFor(
      eml({
        from: '=?ISO-8859-1?Q?Ren=E9e_Dub=E9?= <renee@example.com>',
        subject: 'Poster reprint',
      }),
    );
    expect(ticket.customer.name).toBe('Renée Dubé');
  });

  it('still decodes UTF-8 and plain subjects as before (3)', async () => {
    const utf8 = await ticketFor(
      eml({
        from: 'Jun Park <jun@example.com>',
        subject: '=?UTF-8?B?Q2Fmw6kgbWVudSBwcm9vZnMg4oCUIHdyb25nIGZvbnQ=?=',
      }),
    );
    expect(utf8.subject).toBe('Café menu proofs — wrong font');
    const plain = await ticketFor(
      eml({ from: 'Jun Park <jun2@example.com>', subject: 'Wrong quantity on yard signs' }),
    );
    expect(plain.subject).toBe('Wrong quantity on yard signs');
  });

  it('shows the seeded Cabinet Gagnon email correctly (4)', async () => {
    const raw = readFileSync(
      path.join(repositoryRoot, 'inbox/0039-business-card-proofs-delivery.eml'),
    );
    const ticket = await ticketFor(raw);
    expect(ticket.subject).toBe('Épreuves des cartes de visite : délai de livraison?');
  });

  it('handles the poster-reprint-quote drop fixture (4)', async () => {
    const raw = readFileSync(path.join(repositoryRoot, 'fixtures/mail/poster-reprint-quote.eml'));
    const ticket = await ticketFor(raw);
    expect(ticket.subject).toBe("Devis pour une réimpression d'affiches");
    expect(ticket.customer.name).toBe('Renée Dubé');
  });
});
