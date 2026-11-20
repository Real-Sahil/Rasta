/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { METROBUS_STATIONS, METRO_CITY_IDS, METRO_CITY_NAMES, METRO_LINES, ORANGELINE_STATIONS, OSM_CREDIT, OSM_UPDATED, lineStations, metroCityFor, stationName } from '../data/osmData';
import { TransitStation } from '../types';
import { LineDiagram } from './LineDiagram';
import { TransitReports } from './TransitReports';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { Train, Bus, MapPin, Calculator, Check, ArrowRight, ShieldCheck, Ticket } from 'lucide-react';

interface TransitPlannerProps {
  onSelectStation: (station: TransitStation) => void;
  city?: string;
}

export const TransitPlanner: React.FC<TransitPlannerProps> = ({ onSelectStation, city = 'lahore' }) => {
  const { isRtl, t } = useMobilityTheme();
  const metroCities = ['lahore', ...METRO_CITY_IDS.filter((c) => c !== 'lahore')];
  const [metroCity, setMetroCity] = useState(() => (metroCities.includes(metroCityFor(city)) ? metroCityFor(city) : 'lahore'));
  const [activeTab, setActiveTab] = useState<'metrobus' | 'orangeline' | 'calculator'>('metrobus');
  const [view, setView] = useState<'list' | 'diagram'>('list');
  const diagram = (list: typeof METROBUS_STATIONS, color: string) => (
    <LineDiagram stations={list} color={color} isRtl={isRtl} onPick={onSelectStation} boardLabel={t.diagramBoard} alightLabel={t.diagramAlight} note={t.diagramNote} />
  );
  const viewToggle = (
    <div role="group" className="ui-seg ui-seg-sm">
      {(['list', 'diagram'] as const).map(v => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
          >
          {v === 'list' ? t.viewList : t.viewDiagram}
        </button>
      ))}
    </div>
  );

  // Fare calculator state
  const [calcLine, setCalcLine] = useState<'metrobus' | 'orangeline'>('orangeline');
  const [originId, setOriginId] = useState(ORANGELINE_STATIONS[0]?.id ?? '');
  const [destId, setDestId] = useState(ORANGELINE_STATIONS[ORANGELINE_STATIONS.length - 1]?.id ?? '');
  const [isStudent, setIsStudent] = useState(false);

  const stations = calcLine === 'metrobus' ? METROBUS_STATIONS : ORANGELINE_STATIONS;

  // Calculate fare between stations
  const origIndex = stations.findIndex(s => s.id === originId);
  const destIndex = stations.findIndex(s => s.id === destId);
  const stationCount = Math.abs(destIndex - origIndex);

  let calculatedFare = stationCount === 0 ? 0 : 30; // Metrobus flat fare (estimate)
  if (stationCount === 0) {
    calculatedFare = 0;
  } else if (calcLine === 'orangeline') {
    if (stationCount <= 4) calculatedFare = 20;
    else if (stationCount <= 8) calculatedFare = 25;
    else if (stationCount <= 12) calculatedFare = 30;
    else if (stationCount <= 16) calculatedFare = 35;
    else calculatedFare = 40;
  }
  if (isStudent) {
    calculatedFare = Math.round(calculatedFare / 2);
  }

  const travelTimeMins = calcLine === 'metrobus'
    ? Math.max(5, stationCount * 2.8)
    : Math.max(4, stationCount * 2.1);

  return (
    <div className="space-y-3">
      {metroCities.length > 1 && (
        <div role="group" aria-label={t.metroCityLabel} className="flex gap-1.5 overflow-x-auto pb-0.5">
          {metroCities.map((c) => (
            <button key={c} type="button" aria-pressed={metroCity === c} onClick={() => setMetroCity(c)}
              className="ui-chip shrink-0">
              {isRtl ? METRO_CITY_NAMES[c]?.ur ?? c : METRO_CITY_NAMES[c]?.en ?? c}
            </button>
          ))}
        </div>
      )}
      {metroCity !== 'lahore' ? (
        <CityLines city={metroCity} isRtl={isRtl} t={t} viewToggle={viewToggle} view={view} onPick={onSelectStation} />
      ) : (<>
      {/* Tab Nav */}
      <div className="ui-seg" role="group">
        <button
          type="button"
          onClick={() => setActiveTab('metrobus')}
          aria-pressed={activeTab === 'metrobus'}
        >
          <Bus className="w-4 h-4" />
          <span>{isRtl ? 'لاہور میٹرو بس' : 'Metrobus'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orangeline')}
          aria-pressed={activeTab === 'orangeline'}
        >
          <Train className="w-4 h-4" />
          <span>{isRtl ? 'اورنج لائن' : 'Orange'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          aria-pressed={activeTab === 'calculator'}
        >
          <Calculator className="w-4 h-4" />
          <span>{isRtl ? 'کرایہ' : 'Fare'}</span>
        </button>
      </div>

      {/* Metrobus Line List */}
      {activeTab === 'metrobus' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between ui-sub pb-1">
            <span>{METROBUS_STATIONS.length ? `${METROBUS_STATIONS[0].name} ↔ ${METROBUS_STATIONS[METROBUS_STATIONS.length - 1].name} (${METROBUS_STATIONS.length} stops)` : 'No station data yet'}</span>
            <span className="font-bold text-rose-600">Flat Rs. 30</span>
          </div>

          <div className="flex justify-end">{viewToggle}</div>
          {view === 'diagram' ? diagram(METROBUS_STATIONS, '#E11D48') : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {METROBUS_STATIONS.map((station, idx) => (
              <div
                key={station.id}
                onClick={() => onSelectStation(station)}
                className="px-3 py-2.5 rounded-[18px] bg-[color:var(--paper)] hover:ring-1 hover:ring-[color:var(--line)] transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-[color:var(--ink)]">
                      {stationName(station, isRtl)}
                    </h5>
                  </div>
                </div>

                <button
                  type="button"
                  className="ui-btn ui-btn-soft h-8 px-3 text-xs"
                >
                  {isRtl ? 'راستہ' : 'Map'}
                </button>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Orange Line Metro List */}
      {activeTab === 'orangeline' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between ui-sub pb-1">
            <span>{ORANGELINE_STATIONS.length ? `${ORANGELINE_STATIONS[0].name} ↔ ${ORANGELINE_STATIONS[ORANGELINE_STATIONS.length - 1].name} (${ORANGELINE_STATIONS.length} stops)` : 'No station data yet'}</span>
            <span className="font-bold text-amber-600">Distance: Rs. 20 - 40</span>
          </div>

          <div className="flex justify-end">{viewToggle}</div>
          {view === 'diagram' ? diagram(ORANGELINE_STATIONS, '#F26A21') : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {ORANGELINE_STATIONS.map((station, idx) => (
              <div
                key={station.id}
                onClick={() => onSelectStation(station)}
                className="px-3 py-2.5 rounded-[18px] bg-[color:var(--paper)] hover:ring-1 hover:ring-[color:var(--line)] transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-[color:var(--ink)]">
                      {stationName(station, isRtl)}
                    </h5>
                  </div>
                </div>

                <button
                  type="button"
                  className="ui-btn ui-btn-soft h-8 px-3 text-xs"
                >
                  {isRtl ? 'راستہ' : 'Map'}
                </button>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Fare Calculator Tab */}
      {activeTab === 'calculator' && (
        <div className="space-y-3 pt-1">
          <div className="ui-seg" role="group">
            <button
              type="button"
              onClick={() => {
                setCalcLine('orangeline');
                setOriginId(ORANGELINE_STATIONS[0]?.id ?? '');
                setDestId(ORANGELINE_STATIONS[ORANGELINE_STATIONS.length - 1]?.id ?? '');
              }}
              aria-pressed={calcLine === 'orangeline'}
            >
              Orange Line Train
            </button>
            <button
              type="button"
              onClick={() => {
                setCalcLine('metrobus');
                setOriginId(METROBUS_STATIONS[0]?.id ?? '');
                setDestId(METROBUS_STATIONS[METROBUS_STATIONS.length - 1]?.id ?? '');
              }}
              aria-pressed={calcLine === 'metrobus'}
            >
              Lahore Metrobus
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-xs font-semibold text-[color:var(--ink-2)] mb-1">
                {isRtl ? 'آغاز کا اسٹیشن' : 'Origin Station'}
              </label>
              <select
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                className="w-full p-2 rounded-xl border-0 ring-1 ring-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--ink)] text-sm font-semibold"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.id}>
                    {stationName(s, isRtl)} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[color:var(--ink-2)] mb-1">
                {isRtl ? 'منزل کا اسٹیشن' : 'Destination Station'}
              </label>
              <select
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="w-full p-2 rounded-xl border-0 ring-1 ring-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--ink)] text-sm font-semibold"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.id}>
                    {stationName(s, isRtl)} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-[color:var(--paper)] text-xs">
              <span className="font-semibold">{t.studentConcession}</span>
              <input
                type="checkbox"
                checked={isStudent}
                onChange={(e) => setIsStudent(e.target.checked)}
                className="w-5 h-5 accent-[color:var(--brand)] cursor-pointer"
              />
            </div>
          </div>

          <LineDiagram stations={stations} color={calcLine === 'metrobus' ? '#E11D48' : '#F26A21'} isRtl={isRtl} fromId={originId} toId={destId} boardLabel={t.diagramBoard} alightLabel={t.diagramAlight} note={t.diagramNote} />

          {/* Result Card */}
          <div className="p-4 bg-[color:var(--ink)] text-[color:var(--paper)] rounded-[22px] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold opacity-75">
                Estimated Fare (verify at station)
              </span>
              <div className="font-display num text-[30px] font-extrabold leading-tight">
                Rs. {calculatedFare}
              </div>
              <span className="text-xs opacity-75 num">
                {stationCount} Stations • ~{Math.round(travelTimeMins)} mins travel time
              </span>
            </div>

            <div className="ui-signal w-12 h-12 rounded-2xl flex items-center justify-center">
              <Ticket className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}
      </>)}
      <TransitReports city={city} />
      <p className="text-[11px] text-[color:var(--ink-2)]">
        {OSM_CREDIT}{OSM_UPDATED ? `, updated ${OSM_UPDATED}` : ''}.{metroCity === 'lahore' ? ' Fares are estimates; check at the station.' : ''}
      </p>
    </div>
  );
};

const FALLBACK_COLOURS = ['#0E7490', '#7C3AED', '#16A34A', '#DC2626', '#2563EB', '#CA8A04'];

/** Lines of one city outside Lahore: one tab per line, list or schematic, tap a station to route to it. No fares. */
const CityLines: React.FC<{
  city: string;
  isRtl: boolean;
  t: ReturnType<typeof useMobilityTheme>['t'];
  viewToggle: React.ReactNode;
  view: 'list' | 'diagram';
  onPick: (s: TransitStation) => void;
}> = ({ city, isRtl, t, viewToggle, view, onPick }) => {
  const lines = React.useMemo(() => METRO_LINES.filter((l) => l.city === city), [city]);
  const [lineId, setLineId] = useState(lines[0]?.id ?? '');
  const line = lines.find((l) => l.id === lineId) ?? lines[0];
  const stations = React.useMemo(() => (line ? lineStations(line) : []), [line]);
  if (!line) return null;
  const colourOf = (i: number) => lines[i].colour ?? FALLBACK_COLOURS[i % FALLBACK_COLOURS.length];
  const colour = colourOf(lines.indexOf(line));
  const label = (l: typeof line) => (isRtl && l.nameUrdu) || l.name;
  return (
    <div className="space-y-2">
      {lines.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {lines.map((l, i) => (
            <button key={l.id} type="button" aria-pressed={l.id === line.id} onClick={() => setLineId(l.id)}
              style={l.id === line.id ? { background: colourOf(i) } : undefined}
              className={`ui-chip truncate max-w-full ${l.id === line.id ? '!text-white !border-transparent' : ''}`}>
              {label(l)}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 ui-sub pb-1">
        <span className="min-w-0 truncate"><b className="text-[color:var(--ink)]">{label(line)}</b> · {stationName(stations[0], isRtl)} ↔ {stationName(stations[stations.length - 1], isRtl)} ({stations.length})</span>
        {viewToggle}
      </div>
      {view === 'diagram' ? (
        <LineDiagram stations={stations} color={colour} isRtl={isRtl} onPick={onPick} boardLabel={t.diagramBoard} alightLabel={t.diagramAlight} note={t.diagramNote} />
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {stations.map((s, idx) => (
            <button key={s.id} type="button" onClick={() => onPick(s)}
              className="w-full text-start px-3 py-2.5 rounded-[18px] bg-[color:var(--paper)] hover:ring-1 hover:ring-[color:var(--line)] cursor-pointer flex items-center gap-2.5">
              <span className="w-6 h-6 shrink-0 rounded-full text-white font-bold text-[10px] flex items-center justify-center" style={{ background: colour }}>{idx + 1}</span>
              <span className="font-bold text-xs sm:text-sm text-[color:var(--ink)] truncate">{stationName(s, isRtl)}</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-[color:var(--ink-2)]">{t.metroNoFares}</p>
    </div>
  );
};
