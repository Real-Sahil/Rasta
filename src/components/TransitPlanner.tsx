/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { METROBUS_STATIONS, ORANGELINE_STATIONS } from '../data/pakistanLocations';
import { TransitStation } from '../types';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import { Train, Bus, MapPin, Calculator, Check, ArrowRight, ShieldCheck, Ticket } from 'lucide-react';

interface TransitPlannerProps {
  onSelectStation: (station: TransitStation) => void;
}

export const TransitPlanner: React.FC<TransitPlannerProps> = ({ onSelectStation }) => {
  const { isRtl, t } = useMobilityTheme();
  const [activeTab, setActiveTab] = useState<'metrobus' | 'orangeline' | 'calculator'>('metrobus');

  // Fare calculator state
  const [calcLine, setCalcLine] = useState<'metrobus' | 'orangeline'>('orangeline');
  const [originId, setOriginId] = useState(ORANGELINE_STATIONS[0].id);
  const [destId, setDestId] = useState(ORANGELINE_STATIONS[ORANGELINE_STATIONS.length - 1].id);
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
    <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
      {/* Tab Nav */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('metrobus')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'metrobus'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Bus className="w-4 h-4" />
          <span>{isRtl ? 'لاہور میٹرو بس' : 'Metrobus'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orangeline')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'orangeline'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Train className="w-4 h-4" />
          <span>{isRtl ? 'اورنج لائن ٹرین' : 'Orange Line'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'calculator'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>{isRtl ? 'کرایہ معلوم کریں' : 'Fare Calc'}</span>
        </button>
      </div>

      {/* Metrobus Line List */}
      {activeTab === 'metrobus' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">
            <span>Shahdara ↔ Gajju Matah ({METROBUS_STATIONS.length} stations listed)</span>
            <span className="font-bold text-rose-600">Flat Rs. 30</span>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {METROBUS_STATIONS.map((station, idx) => (
              <div
                key={station.id}
                onClick={() => onSelectStation(station)}
                className="p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                      {isRtl ? station.nameUrdu : station.name}
                    </h5>
                    <span className="text-[10px] text-slate-400">{station.facilities.join(' • ')}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="p-1.5 text-xs text-rose-600 hover:bg-rose-100 rounded-lg font-semibold"
                >
                  {isRtl ? 'راستہ' : 'Map'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orange Line Metro List */}
      {activeTab === 'orangeline' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">
            <span>Ali Town ↔ Dera Gujran ({ORANGELINE_STATIONS.length} stations listed)</span>
            <span className="font-bold text-amber-600">Distance: Rs. 20 - 40</span>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {ORANGELINE_STATIONS.map((station, idx) => (
              <div
                key={station.id}
                onClick={() => onSelectStation(station)}
                className="p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                      {isRtl ? station.nameUrdu : station.name}
                    </h5>
                    <span className="text-[10px] text-slate-400">{station.facilities.join(' • ')}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="p-1.5 text-xs text-amber-600 hover:bg-amber-100 rounded-lg font-semibold"
                >
                  {isRtl ? 'راستہ' : 'Map'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fare Calculator Tab */}
      {activeTab === 'calculator' && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setCalcLine('orangeline');
                setOriginId(ORANGELINE_STATIONS[0].id);
                setDestId(ORANGELINE_STATIONS[ORANGELINE_STATIONS.length - 1].id);
              }}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                calcLine === 'orangeline'
                  ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-slate-200 text-slate-600 dark:border-slate-800'
              }`}
            >
              Orange Line Train
            </button>
            <button
              type="button"
              onClick={() => {
                setCalcLine('metrobus');
                setOriginId(METROBUS_STATIONS[0].id);
                setDestId(METROBUS_STATIONS[METROBUS_STATIONS.length - 1].id);
              }}
              className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                calcLine === 'metrobus'
                  ? 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
                  : 'border-slate-200 text-slate-600 dark:border-slate-800'
              }`}
            >
              Lahore Metrobus
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {isRtl ? 'آغاز کا اسٹیشن' : 'Origin Station'}
              </label>
              <select
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.id}>
                    {isRtl ? s.nameUrdu : s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {isRtl ? 'منزل کا اسٹیشن' : 'Destination Station'}
              </label>
              <select
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.id}>
                    {isRtl ? s.nameUrdu : s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
              <span className="font-semibold">{t.studentConcession}</span>
              <input
                type="checkbox"
                checked={isStudent}
                onChange={(e) => setIsStudent(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Result Card */}
          <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-100 tracking-wider">
                Estimated Fare (verify at station)
              </span>
              <div className="text-2xl font-black">
                Rs. {calculatedFare}
              </div>
              <span className="text-xs text-emerald-100">
                {stationCount} Stations • ~{Math.round(travelTimeMins)} mins travel time
              </span>
            </div>

            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <Ticket className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
