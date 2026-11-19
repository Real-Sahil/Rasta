/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { ApiError } from '../services/incidentsApi';
import { REPORT_CITIES, REPORT_MODES, ReportKind, ReportMode, TransitStat, fetchTransitStats, sendTransitReport } from '../services/transitReportsApi';

const MODE_KEY: Record<ReportMode, string> = {
  metrobus: 'repModeMetrobus', orange_line: 'repModeOrange', bus: 'repModeBus', van: 'repModeVan',
  rickshaw: 'repModeRickshaw', taxi: 'repModeTaxi', ride_hail: 'repModeRideHail'
};

/** Riders report what they paid or how late a service was. Typical values appear only with enough independent reports. */
export const TransitReports: React.FC<{ city: string }> = ({ city }) => {
  const { t, isRtl } = useMobilityTheme();
  const tr = t as unknown as Record<string, string>;
  const supported = REPORT_CITIES.includes(city);
  const [stats, setStats] = useState<TransitStat[] | null>(null);
  const [kind, setKind] = useState<ReportKind>('fare');
  const [mode, setMode] = useState<ReportMode>('rickshaw');
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let live = true;
    fetchTransitStats(city).then((s) => live && setStats(s)).catch(() => live && setStats(null));
    return () => { live = false; };
  }, [city, supported, msg]);

  if (!supported) return null;
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= (kind === 'fare' ? 20000 : 240);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await sendTransitReport({ city, kind, mode, value: n });
      setValue('');
      setMsg(tr.repThanks);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setMsg(code === 'duplicate_report' ? tr.repDuplicate : code === 'rate_limited' ? tr.repLimit : tr.repNoBackend);
    } finally { setBusy(false); }
  };

  const line = (s: TransitStat) =>
    (s.kind === 'fare' ? tr.repTypicalFare : tr.repTypicalDelay)
      .replace('{mode}', tr[MODE_KEY[s.mode]]).replace('{median}', String(s.median)).replace('{lo}', String(s.p25)).replace('{hi}', String(s.p75)).replace('{n}', String(s.n));

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2.5" aria-label={tr.repTitle}>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{tr.repTitle}</h3>
      {stats && stats.length > 0
        ? <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">{stats.map((s) => <li key={`${s.kind}_${s.mode}`}>{line(s)}</li>)}</ul>
        : <p className="text-xs text-slate-500">{tr.repNoStats}</p>}
      <div className="grid grid-cols-2 gap-2 text-xs" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="col-span-2 flex gap-1.5">
          {(['fare', 'delay'] as ReportKind[]).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
              className={`flex-1 py-1.5 rounded-lg font-semibold cursor-pointer ${kind === k ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
              {k === 'fare' ? tr.repFare : tr.repDelay}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">{tr.repMode}
          <select value={mode} onChange={(e) => setMode(e.target.value as ReportMode)} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5">
            {REPORT_MODES.map((m) => <option key={m} value={m}>{tr[MODE_KEY[m]]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">{kind === 'fare' ? 'Rs' : 'min'}
          <input type="number" inputMode="numeric" min={1} max={kind === 'fare' ? 20000 : 240} value={value} onChange={(e) => setValue(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5" />
        </label>
        <button type="button" disabled={!valid || busy} onClick={submit}
          className="col-span-2 py-2 rounded-lg bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold cursor-pointer">{tr.repSubmit}</button>
      </div>
      {msg && <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{msg}</p>}
      <p className="text-[10px] text-slate-400">{tr.repPrivacy}</p>
    </section>
  );
};
