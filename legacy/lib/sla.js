'use strict';

/**
 * Service-level clock.
 *
 * A ticket must be closed within `config.sla.hours` business hours of
 * arriving. Business hours are weekdays between `openHour` and `closeHour`
 * in the support desk's time zone. There are no holidays.
 */

const config = require('../config');
const cache = require('./cache');
const clock = require('./clock');
const Ticket = require('../models/ticket');
const TicketPause = require('../models/ticket-pause');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const AT_RISK_MINUTES = 120;

const wallClockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: config.sla.timeZone,
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
});

/**
 * Weekday and hour on the support desk's wall clock.
 *
 * @param {number} ms
 * @returns {{ weekday: string, hour: number }}
 */
function wallClock(ms) {
  const parts = wallClockFormat.formatToParts(new Date(ms));
  let weekday = '';
  let hour = 0;
  parts.forEach(function (part) {
    if (part.type === 'weekday') weekday = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
  });
  return { weekday: weekday, hour: hour };
}

/** @param {string} weekday */
function isBusinessDay(weekday) {
  return weekday !== 'Sat' && weekday !== 'Sun';
}

/**
 * Is the desk staffed during this hour of the day? 9 to 5: the 17:00 hour is closed.
 *
 * @param {number} hour
 */
function isBusinessHour(hour) {
  return hour >= config.sla.openHour && hour < config.sla.closeHour;
}

/**
 * Our time zone is a whole number of hours off UTC, so local hours start on
 * UTC hour boundaries.
 *
 * @param {number} ms
 */
function startOfNextHour(ms) {
  return (Math.floor(ms / HOUR) + 1) * HOUR;
}

/** @param {number} ms */
function isOpenAt(ms) {
  const local = wallClock(ms);
  return isBusinessDay(local.weekday) && isBusinessHour(local.hour);
}

/**
 * Business minutes between two instants. Zero if end is before start.
 *
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
function businessMinutesBetween(start, end) {
  let cursor = start.getTime();
  const stop = end.getTime();
  let total = 0;
  while (cursor < stop) {
    const next = Math.min(startOfNextHour(cursor), stop);
    if (isOpenAt(cursor)) total += next - cursor;
    cursor = next;
  }
  return Math.floor(total / MINUTE);
}

/**
 * The instant `minutes` business minutes after `start`.
 *
 * @param {Date} start
 * @param {number} minutes
 * @returns {Date}
 */
function addBusinessMinutes(start, minutes) {
  let cursor = start.getTime();
  let remaining = minutes * MINUTE;
  while (remaining > 0) {
    const next = startOfNextHour(cursor);
    if (isOpenAt(cursor)) {
      const available = next - cursor;
      if (available >= remaining) return new Date(cursor + remaining);
      remaining -= available;
    }
    cursor = next;
  }
  return new Date(cursor);
}

/**
 * @typedef {Object} SlaSnapshot
 * @property {number} ticketId
 * @property {string} status
 * @property {string} dueAt
 * @property {string | null} closedAt
 * @property {string | null} pausedAt  When the pause in progress began, if pending.
 */

/**
 * @typedef {Object} SlaSummary
 * @property {number} ticketId
 * @property {string} dueAt
 * @property {'on-track' | 'at-risk' | 'breached' | 'met' | 'missed' | 'paused'} state
 * @property {number | null} remainingMinutes  Negative once breached; null when closed; frozen while paused.
 */

/**
 * The due time counts only finished pauses; the pause in progress is reported
 * as `pausedAt` so the due time stays stable while the ticket waits.
 *
 * @param {any} ticket  A Ticket record or row.
 * @param {any[]} [pauses]  The ticket's TicketPause records.
 * @returns {SlaSnapshot}
 */
function snapshot(ticket, pauses) {
  pauses = pauses || [];
  let pausedMinutes = 0;
  /** @type {string | null} */
  let pausedAt = null;
  pauses.forEach(function (pause) {
    if (pause.ended_at) {
      pausedMinutes += businessMinutesBetween(new Date(pause.started_at), new Date(pause.ended_at));
    } else {
      pausedAt = pause.started_at;
    }
  });
  if (ticket.status !== 'pending') pausedAt = null;
  else if (!pausedAt) pausedAt = ticket.updated_at || null;
  const due = addBusinessMinutes(
    new Date(ticket.created_at),
    config.sla.hours * 60 + pausedMinutes,
  );
  return {
    ticketId: ticket.id,
    status: ticket.status,
    dueAt: due.toISOString(),
    closedAt: ticket.closed_at || null,
    pausedAt: pausedAt,
  };
}

/**
 * @param {SlaSnapshot} snap
 * @param {Date} now
 * @returns {SlaSummary}
 */
function summarize(snap, now) {
  const due = new Date(snap.dueAt);
  if (snap.status === 'closed') {
    const closedAt = snap.closedAt ? new Date(snap.closedAt) : now;
    return {
      ticketId: snap.ticketId,
      dueAt: snap.dueAt,
      state: closedAt.getTime() <= due.getTime() ? 'met' : 'missed',
      remainingMinutes: null,
    };
  }
  if (snap.status === 'pending' && snap.pausedAt) {
    const pausedAt = new Date(snap.pausedAt);
    return {
      ticketId: snap.ticketId,
      dueAt: snap.dueAt,
      state: 'paused',
      remainingMinutes:
        pausedAt.getTime() < due.getTime()
          ? businessMinutesBetween(pausedAt, due)
          : -businessMinutesBetween(due, pausedAt),
    };
  }
  const remaining =
    now.getTime() < due.getTime()
      ? businessMinutesBetween(now, due)
      : -businessMinutesBetween(due, now);
  let state = 'on-track';
  if (now.getTime() >= due.getTime()) state = 'breached';
  else if (remaining <= AT_RISK_MINUTES) state = 'at-risk';
  return {
    ticketId: snap.ticketId,
    dueAt: snap.dueAt,
    state: /** @type {SlaSummary['state']} */ (state),
    remainingMinutes: remaining,
  };
}

/**
 * SLA summary for a ticket, using the cache when it can.
 *
 * @param {number} ticketId
 * @param {(err: Error | null, summary?: SlaSummary | null) => void} cb
 */
function forTicket(ticketId, cb) {
  const key = 'sla:' + ticketId;
  const cached = cache.get(key);
  if (cached) {
    return setImmediate(cb, null, summarize(cached, clock.now()));
  }
  Ticket.find(ticketId, function (err, ticket) {
    if (err) return cb(err);
    if (!ticket) return cb(null, null);
    TicketPause.where({ ticket_id: ticketId }, function (pauseErr, pauses) {
      if (pauseErr) return cb(pauseErr);
      const snap = cache.set(key, snapshot(ticket, pauses));
      cb(null, summarize(snap, clock.now()));
    });
  });
}

module.exports = {
  businessMinutesBetween: businessMinutesBetween,
  addBusinessMinutes: addBusinessMinutes,
  snapshot: snapshot,
  summarize: summarize,
  forTicket: forTicket,
};
