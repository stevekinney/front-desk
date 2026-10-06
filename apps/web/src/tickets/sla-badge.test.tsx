import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { formatBusinessMinutes, SlaBadge } from './sla-badge.tsx';

describe('formatBusinessMinutes', () => {
  it.each([
    [45, '45m'],
    [60, '1h'],
    [200, '3h 20m'],
    [480, '1d'],
    [600, '1d 2h'],
    [-90, '1h 30m'],
  ])('formats %i as %s', (minutes, expected) => {
    expect(formatBusinessMinutes(minutes)).toBe(expected);
  });
});

describe('SlaBadge', () => {
  const dueAt = '2026-10-06T20:00:00.000Z';

  it('counts down while on track', () => {
    render(<SlaBadge sla={{ dueAt, state: 'on-track', remainingMinutes: 200 }} />);
    expect(screen.getByText('Due in 3h 20m')).toHaveClass('sla-on-track');
  });

  it('warns when at risk', () => {
    render(<SlaBadge sla={{ dueAt, state: 'at-risk', remainingMinutes: 45 }} />);
    expect(screen.getByText('Due in 45m')).toHaveClass('sla-at-risk');
  });

  it('shows how overdue a breached ticket is', () => {
    render(<SlaBadge sla={{ dueAt, state: 'breached', remainingMinutes: -75 }} />);
    expect(screen.getByText('Overdue 1h 15m')).toHaveClass('sla-breached');
  });

  it('just says overdue when no business time has passed since the due time', () => {
    render(<SlaBadge sla={{ dueAt, state: 'breached', remainingMinutes: 0 }} />);
    expect(screen.getByText('Overdue')).toHaveClass('sla-breached');
  });

  it('says paused with the frozen time left', () => {
    render(<SlaBadge sla={{ dueAt, state: 'paused', remainingMinutes: 360 }} />);
    const badge = screen.getByText('Paused · 6h left');
    expect(badge).toHaveClass('sla-paused');
    expect(badge).toHaveAttribute('title', expect.not.stringMatching(/^Due/));
  });

  it('says paused and overdue when it was already late', () => {
    render(<SlaBadge sla={{ dueAt, state: 'paused', remainingMinutes: -60 }} />);
    expect(screen.getByText('Paused · overdue 1h')).toHaveClass('sla-paused');
  });

  it('shows the outcome once closed', () => {
    render(<SlaBadge sla={{ dueAt, state: 'missed', remainingMinutes: null }} />);
    expect(screen.getByText('SLA missed')).toBeInTheDocument();
  });
});
