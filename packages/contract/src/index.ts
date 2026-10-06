import type { components, operations, paths } from './generated/schema.js';

export type { components, operations, paths };

type Schemas = components['schemas'];

export type ApiError = Schemas['Error'];
export type BusinessHours = Schemas['BusinessHours'];
export type CannedReply = Schemas['CannedReply'];
export type CannedReplyInput = Schemas['CannedReplyInput'];
export type Customer = Schemas['Customer'];
export type Message = Schemas['Message'];
export type ReplyInput = Schemas['ReplyInput'];
export type SimulatedMail = Schemas['SimulatedMail'];
export type SlaReportRow = Schemas['SlaReportRow'];
export type Sla = Schemas['Sla'];
export type SlaState = Sla['state'];
export type Tag = Schemas['Tag'];
export type TagWithCount = Schemas['TagWithCount'];
export type TagInput = Schemas['TagInput'];
export type Teammate = Schemas['Teammate'];
export type Ticket = Schemas['Ticket'];
export type TicketDetail = Schemas['TicketDetail'];
export type TicketStatus = Schemas['TicketStatus'];

export const TICKET_STATUSES = [
  'open',
  'pending',
  'closed',
] as const satisfies readonly TicketStatus[];
