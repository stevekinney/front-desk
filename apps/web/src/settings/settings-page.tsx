import { useState, type FormEvent } from 'react';

import type { BusinessHours } from '@front-desk/contract';

import { ApiRequestError } from '../api-client.ts';
import { useApi } from '../use-api.ts';
import { getBusinessHours, saveBusinessHours } from './settings-api.ts';

export function SettingsPage() {
  const { data, error, loading } = useApi(getBusinessHours, 'business-hours');

  return (
    <section className="settings-page">
      <h1>Settings</h1>
      {error && !data ? <p role="alert">{error.message}</p> : null}
      {!data && loading ? <p>Loading…</p> : null}
      {data ? <BusinessHoursForm initial={data} /> : null}
    </section>
  );
}

const toNumber = (text: string) => (text.trim() === '' ? NaN : Number(text));

function BusinessHoursForm({ initial }: { initial: BusinessHours }) {
  const [openHour, setOpenHour] = useState(String(initial.openHour));
  const [closeHour, setCloseHour] = useState(String(initial.closeHour));
  const [timeZone, setTimeZone] = useState(initial.timeZone);
  const [slaHours, setSlaHours] = useState(String(initial.slaHours));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setProblems([]);
    try {
      await saveBusinessHours({
        openHour: toNumber(openHour),
        closeHour: toNumber(closeHour),
        timeZone,
        slaHours: toNumber(slaHours),
      });
      setSaved(true);
    } catch (err) {
      const issues = err instanceof ApiRequestError ? err.body?.issues : undefined;
      setProblems(
        issues?.length
          ? issues.map((issue) => `${issue.path}: ${issue.message}`)
          : [(err as Error).message],
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={(event) => void submit(event)}>
      <label htmlFor="settings-open-hour">Opens at</label>
      <input
        id="settings-open-hour"
        type="number"
        min={0}
        max={24}
        value={openHour}
        onChange={(event) => setOpenHour(event.target.value)}
      />
      <label htmlFor="settings-close-hour">Closes at</label>
      <input
        id="settings-close-hour"
        type="number"
        min={0}
        max={24}
        value={closeHour}
        onChange={(event) => setCloseHour(event.target.value)}
      />
      <label htmlFor="settings-time-zone">Time zone</label>
      <input
        id="settings-time-zone"
        type="text"
        value={timeZone}
        onChange={(event) => setTimeZone(event.target.value)}
      />
      <label htmlFor="settings-sla-hours">SLA hours</label>
      <input
        id="settings-sla-hours"
        type="number"
        min={1}
        value={slaHours}
        onChange={(event) => setSlaHours(event.target.value)}
      />
      {problems.length ? (
        <div role="alert">
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      ) : null}
      {saved ? <p role="status">Saved</p> : null}
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
