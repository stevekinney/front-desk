import type { TicketStatus } from '@front-desk/contract';

export const teammates = [
  { name: 'Priya Raman', email: 'priya@frontdesk.example' },
  { name: 'Dana Whitfield', email: 'dana@frontdesk.example' },
  { name: 'Marcus Lee', email: 'marcus@frontdesk.example' },
  { name: 'Jo Alvarez', email: 'jo@frontdesk.example' },
] as const;

type TeammateKey = 'priya' | 'dana' | 'marcus' | 'jo';

export const tags = [
  { name: 'billing', color: '#2b6cb0' },
  { name: 'shipping', color: '#c05621' },
  { name: 'account', color: '#6b46c1' },
  { name: 'printing', color: '#2f855a' },
  { name: 'spam', color: '#718096' },
  { name: 'urgent', color: '#c53030' },
] as const;

type TagName = (typeof tags)[number]['name'];

export const cannedReplies = [
  {
    title: 'Refund on its way',
    body:
      'Hi {{customer.name}},\n\nI have issued a refund for the duplicate charge. ' +
      'It usually shows up on your statement within 5 to 7 business days.\n\n' +
      'Thanks for your patience,\n{{teammate.name}}',
  },
  {
    title: 'Reset your password',
    body:
      'Hi {{customer.name}},\n\nI have sent a fresh password reset link to this address. ' +
      'It is valid for 24 hours. If it still says it has expired, reply here and I will reset it by hand.\n\n' +
      '{{teammate.name}}',
  },
  {
    title: 'Need your order number',
    body:
      'Hi {{customer.name}},\n\nCould you send me the order number? It starts with "PP-" and is ' +
      'in your confirmation email. Then I can look into this right away.\n\n{{teammate.name}}',
  },
  {
    title: 'Reprint approved',
    body:
      'Hi {{customer.name}},\n\nSorry about that. I have approved a free reprint, and it will ship ' +
      'with expedited delivery. You will get a tracking number by email.\n\n' +
      '{{teammate.name}} (ticket #{{ticket.id}})',
  },
] as const;

export const vipCustomers = [
  'accounts@martinezlegal.example',
  'hannah@okoroevents.example',
  'diego@ramosbrewing.example',
];

export interface SeedTicketState {
  /** Hours between the ticket arriving and the moment the database is seeded. */
  ageHours: number;
  status: TicketStatus;
  /** For closed tickets: wall-clock hours from arrival to close. */
  closedAfterHours?: number;
  assignee?: TeammateKey;
  tags?: TagName[];
  replies?: Array<{ from: TeammateKey; body: string }>;
}

/**
 * Where each seeded conversation stands, keyed by the inbox file that opened it.
 * Follow-up messages in the inbox thread onto these tickets on their own.
 */
export const ticketStates: Record<string, SeedTicketState> = {
  '0001-damaged-business-cards.json': {
    ageHours: 520,
    status: 'closed',
    closedAfterHours: 74,
    assignee: 'dana',
    tags: ['shipping'],
    replies: [
      {
        from: 'dana',
        body: 'Hi Theo, so sorry about that. A replacement run is going out with overnight shipping today.',
      },
    ],
  },
  '0002-double-charge.json': {
    ageHours: 510,
    status: 'closed',
    closedAfterHours: 120,
    assignee: 'priya',
    tags: ['billing'],
    replies: [
      {
        from: 'priya',
        body: 'Hi Maya, I found the duplicate and refunded it. It can take 5 to 7 business days to show up.',
      },
    ],
  },
  '0003-password-reset-loop.json': {
    ageHours: 490,
    status: 'closed',
    closedAfterHours: 3,
    assignee: 'marcus',
    tags: ['account'],
    replies: [
      {
        from: 'marcus',
        body: 'Hi Arjun, I reset it by hand. Check your email for a temporary password.',
      },
    ],
  },
  '0004-poster-colors-off.json': {
    ageHours: 485,
    status: 'pending',
    assignee: 'jo',
    tags: ['printing'],
    replies: [
      { from: 'jo', body: 'Hi Lena, could you send a photo of a poster next to the proof?' },
    ],
  },
  '0005-change-shipping-address.json': {
    ageHours: 480,
    status: 'closed',
    closedAfterHours: 2,
    assignee: 'dana',
    tags: ['shipping'],
  },
  '0006-invoice-for-accounting.json': {
    ageHours: 460,
    status: 'closed',
    closedAfterHours: 5,
    assignee: 'priya',
    tags: ['billing'],
  },
  '0007-upload-fails-large-pdf.json': { ageHours: 455, status: 'open', assignee: 'marcus' },
  '0008-bulk-discount-question.json': {
    ageHours: 450,
    status: 'closed',
    closedAfterHours: 6,
    assignee: 'jo',
  },
  '0009-cancel-subscription.json': {
    ageHours: 430,
    status: 'closed',
    closedAfterHours: 1,
    assignee: 'priya',
    tags: ['billing', 'account'],
  },
  '0011-wrong-paper-stock.json': {
    ageHours: 400,
    status: 'pending',
    assignee: 'dana',
    tags: ['printing'],
    replies: [
      { from: 'dana', body: 'Hi Grace, can you confirm the address before we reprint on matte?' },
    ],
  },
  '0012-tracking-not-updating.json': {
    ageHours: 380,
    status: 'closed',
    closedAfterHours: 4,
    assignee: 'dana',
    tags: ['shipping'],
  },
  '0013-two-factor-locked-out.json': {
    ageHours: 375,
    status: 'closed',
    closedAfterHours: 20,
    assignee: 'marcus',
    tags: ['account'],
  },
  '0014-seo-services-offer.json': {
    ageHours: 370,
    status: 'closed',
    closedAfterHours: 1,
    tags: ['spam'],
  },
  '0016-sticker-cut-lines.json': {
    ageHours: 330,
    status: 'open',
    assignee: 'jo',
    tags: ['printing'],
  },
  '0017-rush-order.json': {
    ageHours: 260,
    status: 'closed',
    closedAfterHours: 2,
    assignee: 'priya',
  },
  '0018-email-change.json': {
    ageHours: 255,
    status: 'closed',
    closedAfterHours: 3,
    assignee: 'marcus',
    tags: ['account'],
  },
  '0019-tax-exempt.json': {
    ageHours: 240,
    status: 'pending',
    assignee: 'priya',
    tags: ['billing'],
  },
  '0020-checkout-error.json': {
    ageHours: 235,
    status: 'open',
    assignee: 'marcus',
    tags: ['billing', 'urgent'],
  },
  '0021-thank-you-note.json': { ageHours: 230, status: 'closed', closedAfterHours: 1 },
  '0023-account-merge.json': { ageHours: 210, status: 'open', tags: ['account'] },
  '0024-delivery-signature.json': {
    ageHours: 205,
    status: 'closed',
    closedAfterHours: 2,
    assignee: 'dana',
    tags: ['shipping'],
  },
  '0025-api-key-request.json': { ageHours: 190, status: 'open' },
  '0026-lottery-winner.json': {
    ageHours: 180,
    status: 'closed',
    closedAfterHours: 1,
    tags: ['spam'],
  },
  '0027-missing-items.json': {
    ageHours: 170,
    status: 'open',
    assignee: 'dana',
    tags: ['shipping'],
  },
  '0028-proof-approval-stuck.json': {
    ageHours: 160,
    status: 'open',
    assignee: 'marcus',
    tags: ['printing'],
  },
  '0029-receipt-resend.json': {
    ageHours: 120,
    status: 'closed',
    closedAfterHours: 1,
    assignee: 'priya',
    tags: ['billing'],
  },
  '0030-print-club-billing.json': {
    ageHours: 100,
    status: 'open',
    assignee: 'priya',
    tags: ['billing'],
  },
  '0031-envelope-sizes.json': { ageHours: 50, status: 'open' },
  '0032-banner-grommets.json': { ageHours: 30, status: 'open', assignee: 'jo', tags: ['printing'] },
  '0033-gift-card-not-working.json': { ageHours: 20, status: 'open', tags: ['billing'] },
  '0034-delete-my-data.json': { ageHours: 8, status: 'open', tags: ['account'] },
  '0035-calendar-misprint.json': { ageHours: 5, status: 'open' },
  '0036-menu-reorder.json': { ageHours: 3, status: 'open' },
  '0037-cafe-menu-proofs.eml': { ageHours: 1.5, status: 'open' },
  '0038-yard-sign-quantity.eml': { ageHours: 0.5, status: 'open' },
  '0039-business-card-proofs-delivery.eml': {
    ageHours: 26,
    status: 'open',
    assignee: 'marcus',
    tags: ['shipping'],
  },
  '0040-brochure-print-checklist.json': { ageHours: 52, status: 'open' },
  '0041-supplier-audit-notice.json': { ageHours: 75, status: 'open' },
};
