/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { TransitStation } from '../types';
import { stationName } from '../data/osmData';

interface Props {
  stations: TransitStation[];
  /** Line colour (CSS colour). */
  color: string;
  isRtl: boolean;
  /** Highlight the ride between these station ids (fare calculator). */
  fromId?: string;
  toId?: string;
  onPick?: (s: TransitStation) => void;
  boardLabel: string;
  alightLabel: string;
  note: string;
}

/**
 * Beck-style schematic: one line, one tick per station, names to the side.
 * Order comes from the data (OpenStreetMap relation order); spacing is even, so it is NOT to scale and says so.
 */
export const LineDiagram: React.FC<Props> = ({ stations, color, isRtl, fromId, toId, onPick, boardLabel, alightLabel, note }) => {
  const a = stations.findIndex((s) => s.id === fromId);
  const b = stations.findIndex((s) => s.id === toId);
  const hasRide = a >= 0 && b >= 0 && a !== b;
  const lo = Math.min(a, b), hi = Math.max(a, b);

  return (
    <div>
      <ol className="max-h-72 overflow-y-auto pr-1">
        {stations.map((s, i) => {
          const inRide = hasRide && i >= lo && i <= hi;
          const isFrom = hasRide && i === a, isTo = hasRide && i === b;
          const first = i === 0, last = i === stations.length - 1;
          const interactive = !!onPick;
          return (
            <li key={s.id} className="flex items-stretch gap-3 min-h-[34px]">
              <div className="relative w-9 shrink-0">
                {inRide && (
                  <div aria-hidden className="absolute left-1/2 -translate-x-1/2 w-[18px] bg-slate-900 dark:bg-white"
                    style={{ top: i === lo ? '50%' : 0, bottom: i === hi ? '50%' : 0 }} />
                )}
                <div aria-hidden className="absolute left-1/2 -translate-x-1/2 w-2.5"
                  style={{ background: color, top: first ? '50%' : 0, bottom: last ? '50%' : 0 }} />
                {isFrom || isTo ? (
                  <div aria-hidden className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-[5px] border-slate-900 dark:border-white ${isFrom ? 'bg-[color:var(--surface)]' : 'bg-slate-900 dark:bg-white'}`} />
                ) : (
                  <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-[3px] bg-slate-900 dark:bg-slate-100" />
                )}
              </div>
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onPick?.(s)}
                className={`flex-1 min-w-0 py-1.5 text-start flex flex-col justify-center ${interactive ? 'cursor-pointer hover:opacity-70' : 'cursor-default'}`}
              >
                {(isFrom || isTo) && (
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-[color:var(--ink-2)]">
                    {isFrom ? boardLabel : alightLabel} · {s.code}
                  </span>
                )}
                <span className={`truncate text-slate-900 dark:text-slate-100 ${isFrom || isTo ? 'text-sm font-extrabold' : 'text-xs font-medium'}`}>
                  {stationName(s, isRtl)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-[10px] text-slate-500">{note}</p>
    </div>
  );
};
