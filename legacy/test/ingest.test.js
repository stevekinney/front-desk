import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { all, createTeammate, migrate, require, run } from './helpers.js';

const config = require('../config');
const poller = require('../ingest/poller');
const mailer = require('../outbox/mailer');
const drop = require('../lib/drop');
const Ticket = require('../models/ticket');

const pollOnce = promisify(poller.pollOnce);
const sendReply = promisify(mailer.sendReply);
const dropFixture = promisify(drop.dropFixture);

/**
 * @param {string} filename
 * @param {object} mail
 */
function deliver(filename, mail) {
  fs.writeFileSync(path.join(config.inboxDir, filename), JSON.stringify(mail));
}

beforeAll(async () => {
  await migrate();
});

beforeEach(async () => {
  for (const table of ['outbox', 'messages', 'mailroom_seen', 'tickets', 'customers']) {
    await run('DELETE FROM ' + table, []);
  }
  fs.rmSync(config.inboxDir, { recursive: true, force: true });
  fs.mkdirSync(config.inboxDir, { recursive: true });
});

describe('pollOnce', () => {
  it('turns each new file into a ticket', async () => {
    deliver('0001-hello.json', {
      messageId: '<a@example.com>',
      from: { name: 'Ana', email: 'Ana@Example.com' },
      subject: 'Hello',
      text: 'First message',
    });
    deliver('0002-other.json', {
      messageId: '<b@example.com>',
      from: { name: 'Ben', email: 'ben@example.com' },
      subject: 'Another',
      text: 'Second message',
    });

    const deliveries = await pollOnce();

    expect(deliveries.map((d) => d.filename)).toEqual(['0001-hello.json', '0002-other.json']);
    const tickets = await all('SELECT subject, status FROM tickets ORDER BY id', []);
    expect(await all('SELECT DISTINCT priority FROM tickets', [])).toEqual([
      { priority: 'normal' },
    ]);
    expect(tickets).toEqual([
      { subject: 'Hello', status: 'open' },
      { subject: 'Another', status: 'open' },
    ]);
    const customers = await all('SELECT email FROM customers ORDER BY id', []);
    expect(customers.map((c) => c.email)).toEqual(['ana@example.com', 'ben@example.com']);
  });

  it('never ingests the same file twice', async () => {
    deliver('0001-hello.json', {
      from: { email: 'ana@example.com' },
      subject: 'Hello',
      text: 'Hi',
    });
    await pollOnce();
    const second = await pollOnce();

    expect(second).toEqual([]);
    expect(await all('SELECT id FROM tickets', [])).toHaveLength(1);
  });

  it('threads a reply onto the ticket it answers', async () => {
    deliver('0001-question.json', {
      messageId: '<q@example.com>',
      from: { email: 'ana@example.com' },
      subject: 'Question',
      text: 'Is it ready?',
    });
    deliver('0002-follow-up.json', {
      messageId: '<f@example.com>',
      inReplyTo: '<q@example.com>',
      from: { email: 'ana@example.com' },
      subject: 'Re: Question',
      text: 'Any news?',
    });

    const deliveries = await pollOnce();

    expect(deliveries.map((d) => d.created)).toEqual([true, false]);
    expect(await all('SELECT id FROM tickets', [])).toHaveLength(1);
    expect(await all('SELECT body FROM messages ORDER BY id', [])).toEqual([
      { body: 'Is it ready?' },
      { body: 'Any news?' },
    ]);
  });

  it('threads by the [#id] token in the subject', async () => {
    deliver('0001-question.json', {
      from: { email: 'ana@example.com' },
      subject: 'Question',
      text: 'Hi',
    });
    const [first] = await pollOnce();
    deliver('0002-answer.json', {
      from: { email: 'ana@example.com' },
      subject: `Re: Question [#${first.ticketId}]`,
      text: 'Thanks',
    });

    const [second] = await pollOnce();

    expect(second.ticketId).toBe(first.ticketId);
    expect(second.created).toBe(false);
  });

  it('opens a new ticket when someone else uses the token', async () => {
    deliver('0001-question.json', {
      from: { email: 'ana@example.com' },
      subject: 'Question',
      text: 'Hi',
    });
    const [first] = await pollOnce();
    deliver('0002-stranger.json', {
      from: { email: 'eve@example.com' },
      subject: `Re: Question [#${first.ticketId}]`,
      text: 'Me too',
    });

    const [second] = await pollOnce();

    expect(second.created).toBe(true);
    expect(second.ticketId).not.toBe(first.ticketId);
  });

  it('ingests raw .eml files', async () => {
    fs.copyFileSync(
      path.resolve(import.meta.dirname, '../../inbox/0037-cafe-menu-proofs.eml'),
      path.join(config.inboxDir, '0037-cafe-menu-proofs.eml'),
    );

    await pollOnce();

    const [ticket] = await all('SELECT subject FROM tickets', []);
    expect(ticket.subject).toBe('Café menu proofs — wrong font');
    const [message] = await all('SELECT from_name, body FROM messages', []);
    expect(message.from_name).toBe('Zoé Marchand');
    expect(message.body).toContain('crème brûlée');
  });

  it('decodes Latin-1 subjects in raw .eml files', async () => {
    fs.copyFileSync(
      path.resolve(import.meta.dirname, '../../inbox/0039-business-card-proofs-delivery.eml'),
      path.join(config.inboxDir, '0039-business-card-proofs-delivery.eml'),
    );

    await pollOnce();

    const [ticket] = await all('SELECT subject FROM tickets', []);
    expect(ticket.subject).toBe('Épreuves des cartes de visite : délai de livraison?');
  });

  it('decodes a Latin-1 subject and sender name from a dropped fixture', async () => {
    await dropFixture('poster-reprint-quote');

    await pollOnce();

    const [ticket] = await all('SELECT subject FROM tickets', []);
    expect(ticket.subject).toBe("Devis pour une réimpression d'affiches");
    const [message] = await all('SELECT from_name FROM messages', []);
    expect(message.from_name).toBe('Renée Dubé');
    const [customer] = await all('SELECT name FROM customers', []);
    expect(customer.name).toBe('Renée Dubé');
  });

  it('skips files it cannot parse and keeps going', async () => {
    fs.writeFileSync(path.join(config.inboxDir, '0001-broken.json'), '{ not json');
    deliver('0002-fine.json', { from: { email: 'ana@example.com' }, subject: 'Fine', text: 'Hi' });
    const errors = [];
    const original = console.error;
    console.error = (line) => errors.push(line);
    try {
      const deliveries = await pollOnce();
      expect(deliveries.map((d) => d.filename)).toEqual(['0002-fine.json']);
    } finally {
      console.error = original;
    }
    expect(errors[0]).toMatch(/0001-broken\.json/);
  });
});

describe('sendReply', () => {
  it('records an outbound message and queues it in the outbox', async () => {
    const teammate = await createTeammate('Priya Raman', `priya-${Date.now()}@frontdesk.example`);
    deliver('0001-question.json', {
      from: { email: 'ana@example.com' },
      subject: 'Question',
      text: 'Hi',
    });
    const [delivery] = await pollOnce();

    await sendReply({ ticketId: delivery.ticketId, teammateId: teammate.id, body: 'On it!' });

    const [outbox] = await all('SELECT to_address, subject, body FROM outbox', []);
    expect(outbox).toEqual({
      to_address: 'ana@example.com',
      subject: `Re: Question [#${delivery.ticketId}]`,
      body: 'On it!',
    });
    const messages = await all('SELECT direction, author_id FROM messages ORDER BY id', []);
    expect(messages).toEqual([
      { direction: 'inbound', author_id: null },
      { direction: 'outbound', author_id: teammate.id },
    ]);
  });

  it('calls back with null for a missing ticket', async () => {
    const teammate = await createTeammate('Dana', `dana-${Date.now()}@frontdesk.example`);
    expect(await sendReply({ ticketId: 4242, teammateId: teammate.id, body: 'Hi' })).toBeNull();
  });
});

describe('dropFixture', () => {
  it('copies a fixture into the inbox under a unique name', async () => {
    const filename = await dropFixture('refund-request');

    expect(filename).toMatch(/^drop-\d+-refund-request\.json$/);
    const [delivery] = await pollOnce();
    expect(delivery.filename).toBe(filename);
    const ticket = await promisify(Ticket.find)(delivery.ticketId);
    expect(ticket.subject).toBe('Refund for a cancelled order');
  });

  it('rejects an unknown fixture', async () => {
    await expect(dropFixture('no-such-thing')).rejects.toThrow(/No fixture named/);
  });
});
