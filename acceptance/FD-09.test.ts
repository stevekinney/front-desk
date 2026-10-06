import { copyFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ticketStates } from '../apps/api/src/seed/seed-data.ts';
import { pollInbox } from '../apps/api/src/legacy-adapter.ts';
import { createDesk, repositoryRoot, type Desk } from './support/desk.ts';

// Auto-tagging is part of the mailroom's normal processing, so run with the
// automation rules on, as `npm run dev` does.
vi.hoisted(() => {
  process.env.MAILROOM_RULES = 'on';
});

const CATEGORIES = ['billing', 'shipping', 'account', 'printing', 'spam'];

let desk: Desk;

beforeAll(async () => {
  desk = await createDesk();
  for (const name of [...CATEGORIES, 'urgent']) {
    await desk.post('/api/tags', { name, color: '#718096' }).expect(201);
  }
});

async function categoriesOf(id: number): Promise<string[]> {
  const res = await desk.get(`/api/tickets/${id}`).expect(200);
  return (res.body as { tags: Array<{ name: string }> }).tags
    .map((tag) => tag.name)
    .filter((name) => CATEGORIES.includes(name));
}

/** Mail that isn't in the inbox, with the category a teammate would give it. */
const HELD_OUT: Array<{ category: string | null; subject: string; text: string }> = [
  {
    category: 'billing',
    subject: 'Gift card shows a zero balance',
    text: 'My aunt gave me a gift card for your shop, but at checkout it says the balance is $0. The code is on the back of the card.',
  },
  {
    category: 'billing',
    subject: 'Charged for an order I cancelled',
    text: 'I cancelled PP-20811 the same afternoon, but my card was still charged. Can you refund it?',
  },
  {
    category: 'shipping',
    subject: 'Where is my order?',
    text: 'Tracking for PP-20790 has not moved in four days. The courier site still says label created.',
  },
  {
    category: 'shipping',
    subject: 'Please send it to our new address',
    text: 'We moved last week. Can you deliver PP-20802 to 14 Dock Street, Unit 3 instead?',
  },
  {
    category: 'account',
    subject: "Can't log in",
    text: 'Every password reset link you send says it has expired, so I cannot get into my account.',
  },
  {
    category: 'account',
    subject: 'Add a second login for our office manager',
    text: 'Can our office manager get her own login on our company account? Her email is lena@example.com.',
  },
  {
    category: 'printing',
    subject: 'Flyers came out washed out',
    text: 'The blues on our flyers (PP-20777) are much lighter than the proof we approved.',
  },
  {
    category: 'printing',
    subject: 'Bleed for postcards',
    text: 'How much bleed do you need on 4x6 postcards? My file only has a sixteenth of an inch.',
  },
  {
    category: 'spam',
    subject: 'Get your print shop to the first page of Google',
    text: 'Our SEO team can rank your website on the first page in 30 days. Reply YES for a free audit.',
  },
  {
    category: 'spam',
    subject: 'Congratulations, you are this week’s winner!',
    text: 'You have been selected to receive a prize. Confirm your details at the link below to claim it.',
  },
  {
    category: null,
    subject: 'Thank you!',
    text: 'Just wanted to say the wedding programs looked beautiful. Thanks to the whole team.',
  },
];

describe('FD-09: auto-tagging', () => {
  describe('the seeded inbox', () => {
    const tickets = new Map<string, number>();

    beforeAll(async () => {
      const inbox = path.join(repositoryRoot, 'inbox');
      for (const name of readdirSync(inbox).sort()) {
        if (!/\.(json|eml)$/.test(name)) continue;
        copyFileSync(path.join(inbox, name), path.join(process.env.MAILROOM_INBOX ?? '', name));
      }
      for (const delivery of await pollInbox()) {
        if (delivery.created) tickets.set(delivery.filename, delivery.ticketId);
      }
    });

    it('agrees with the teammates on at least 90% of the tickets they tagged (1, 4)', async () => {
      let tagged = 0;
      const disagreements: string[] = [];
      for (const [filename, state] of Object.entries(ticketStates)) {
        const expected = (state.tags ?? []).filter((tag: string) => CATEGORIES.includes(tag));
        if (expected.length === 0) continue;
        tagged += 1;
        const id = tickets.get(filename);
        const actual = id === undefined ? [] : await categoriesOf(id);
        if (!expected.some((tag: string) => actual.includes(tag))) {
          disagreements.push(
            `${filename}: expected ${expected.join('/')}, got ${actual.join('/') || 'nothing'}`,
          );
        }
      }
      expect(tagged).toBeGreaterThan(20);
      expect(disagreements.length, disagreements.join('\n')).toBeLessThanOrEqual(
        Math.floor(tagged * 0.1),
      );
    });

    it.each([
      ['0035-calendar-misprint.json', 'printing'],
      ['0036-menu-reorder.json', 'printing'],
      ['0037-cafe-menu-proofs.eml', 'printing'],
      ['0038-yard-sign-quantity.eml', 'printing'],
      ['0040-brochure-print-checklist.json', 'printing'],
      ['0041-supplier-audit-notice.json', 'spam'],
    ])('tags the untagged %s as %s (1, 3)', async (filename, category) => {
      const id = tickets.get(filename);
      expect(id).toBeDefined();
      expect(await categoriesOf(id ?? 0)).toContain(category);
    });
  });

  describe('new mail', () => {
    it.each(HELD_OUT.map((mail, i) => [mail.category ?? 'no category', mail.subject, i] as const))(
      'tags it %s: "%s" (1, 2, 3)',
      async (_label, _subject, index) => {
        const mail = HELD_OUT[index];
        if (!mail) throw new Error('no such mail');
        const id = await desk.receive({
          from: `fd09-${index}@example.com`,
          subject: mail.subject,
          text: mail.text,
        });
        const categories = await categoriesOf(id);
        if (mail.category) expect(categories).toContain(mail.category);
        else expect(categories).toEqual([]);
      },
    );

    it("keeps a teammate's tags when the customer writes again (5)", async () => {
      const id = await desk.receive({
        from: 'fd09-followup@example.com',
        subject: 'Where is my order?',
        text: 'Tracking has not moved in a week.',
        messageId: '<fd09-first@example.com>',
      });
      await desk.tag(id, 'printing');
      await desk.receive({
        from: 'fd09-followup@example.com',
        subject: 'Re: Where is my order?',
        text: 'Any news?',
        inReplyTo: '<fd09-first@example.com>',
        messageId: '<fd09-second@example.com>',
      });
      expect(await categoriesOf(id)).toContain('printing');
    });
  });
});
