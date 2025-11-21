import type { TemplateContext } from './canned-replies-repository.ts';

const PLACEHOLDER = /\{\{\s*([a-z]+\.[a-z]+)\s*\}\}/gi;

/**
 * Fill in {{customer.name}}, {{ticket.id}}, and {{teammate.name}}. Unknown
 * placeholders are left as they are so a typo is visible in the preview.
 */
export function renderCannedReply(body: string, context: TemplateContext): string {
  const values: Record<string, string> = {
    'customer.name': firstName(context.customerName) ?? 'there',
    'ticket.id': String(context.ticketId),
    'teammate.name': context.teammateName,
  };
  return body.replace(PLACEHOLDER, (match, key: string) => values[key.toLowerCase()] ?? match);
}

function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}
