/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { EMERGENCY_CONTACTS } from '../data/pakistanLocations';
import { HOSPITALS, FUEL_STATIONS, OSM_CREDIT, OSM_UPDATED, stationName } from '../data/osmData';
import { haversineM } from '../core/geo';
import { useMobilityTheme } from './ThemeLayoutWrapper';
import {
  PhoneCall,
  Share2,
  ShieldAlert,
  Fuel,
  Wrench,
  Hospital,
  AlertOctagon,
  Clock,
  ExternalLink,
  MessageCircle
} from 'lucide-react';

interface EmergencyServicesProps {
  userCoords?: { lat: number; lng: number } | null;
  onFocusLocation?: (coords: { lat: number; lng: number }) => void;
}

export const EmergencyServices: React.FC<EmergencyServicesProps> = ({
  userCoords,
  onFocusLocation
}) => {
  const { isRtl, t } = useMobilityTheme();
  const [activeFilter, setActiveFilter] = useState<'hospital' | 'fuel'>('hospital');

  // Nearest first when we have a real GPS fix; otherwise alphabetical (no fake "nearby")
  const services = useMemo(() => {
    const list = activeFilter === 'hospital' ? HOSPITALS : FUEL_STATIONS;
    const withDist = list.map((p) => ({ p, d: userCoords ? haversineM(userCoords, p) : null }));
    withDist.sort((a, b) => (a.d != null && b.d != null ? a.d - b.d : a.p.name.localeCompare(b.p.name)));
    return withDist.slice(0, 30);
  }, [activeFilter, userCoords?.lat, userCoords?.lng]);

  // Generate WhatsApp SOS Message with exact GPS coordinates and emergency plea
  const handleShareSos = () => {
    if (!userCoords) {
      alert(isRtl ? 'GPS لوکیشن دستیاب نہیں۔ براہ کرم مقام کی اجازت دیں اور دوبارہ کوشش کریں۔' : 'No GPS fix yet, so your location cannot be shared. Allow location access and try again, or call 1122 / 15 directly.');
      return;
    }
    const lat = userCoords.lat;
    const lng = userCoords.lng;
    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

    const text = isRtl
      ? `🚨 ہنگامی مدد درکار ہے! (Emergency SOS via Buraq App)\nمیرے موجودہ کوآرڈینیٹس: ${lat.toFixed(5)}, ${lng.toFixed(5)}\nگوگل میپ لوکیشن: ${mapsLink}\nبراہ کرم فوری مدد یا ریسکیو 1122 کو اطلاع دیں۔`
      : `🚨 EMERGENCY ASSISTANCE NEEDED! (Buraq Mobility Platform)\nMy GPS Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}\nGoogle Maps Link: ${mapsLink}\nPlease dispatch assistance or contact Rescue 1122.`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
      {/* Emergency Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="font-extrabold text-base text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
            <span>{t.emergencyTab}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.emergencySubtitle}
          </p>
        </div>

        {/* SOS WhatsApp Share Button */}
        <button
          type="button"
          onClick={handleShareSos}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30 shrink-0"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          <span>{isRtl ? 'واٹس ایپ لوکیشن' : 'SOS WhatsApp'}</span>
        </button>
      </div>

      {/* Official Emergency Contact Helplines */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {EMERGENCY_CONTACTS.map((contact) => (
          <a
            key={contact.id}
            href={`tel:${contact.number}`}
            className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all flex flex-col justify-between group"
          >
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-rose-600 transition-colors">
                {isRtl ? contact.titleUrdu : contact.title}
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                {isRtl ? contact.descriptionUrdu : contact.description}
              </p>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40">
              <span className="text-base font-black text-rose-700 dark:text-rose-400">
                {contact.number}
              </span>
              <PhoneCall className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
            </div>
          </a>
        ))}
      </div>

      {/* Local Road Services (Petrol, Puncture, Mechanics, Hospitals) */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
            {t.nearbyServices}
          </span>
          {/* Filter Pills */}
          <div className="flex items-center gap-1 text-[11px]">
            {([['hospital', isRtl ? 'ہسپتال' : 'Hospitals'], ['fuel', isRtl ? 'پٹرول' : 'Fuel']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveFilter(id)}
                className={`px-2 py-0.5 rounded-lg font-semibold ${activeFilter === id ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {services.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 p-2">
              {isRtl ? 'اس وقت ڈیٹا دستیاب نہیں۔' : 'No place data available yet.'}
            </p>
          )}
          {services.map(({ p, d }) => (
            <div
              key={p.id}
              onClick={() => onFocusLocation && onFocusLocation({ lat: p.lat, lng: p.lng })}
              className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-700 shadow-xs shrink-0">
                  {p.kind === 'fuel' ? <Fuel className="w-4 h-4 text-emerald-600" /> : <Hospital className="w-4 h-4 text-rose-600" />}
                </div>
                <div className="min-w-0">
                  <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">{stationName(p, isRtl)}</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {[d != null ? (d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`) : null, p.address, p.emergency ? (isRtl ? 'ایمرجنسی' : 'Emergency') : null, p.open24h ? '24/7' : null].filter(Boolean).join(' • ')}
                  </p>
                </div>
              </div>
              {p.phone && (
                <a
                  href={`tel:${p.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold flex items-center gap-1 shrink-0"
                >
                  <PhoneCall className="w-3 h-3" />
                  <span>Call</span>
                </a>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">
          {OSM_CREDIT}{OSM_UPDATED ? `, updated ${OSM_UPDATED}` : ''}. {isRtl ? 'فون نمبر اور اوقات صرف جہاں معلوم ہوں۔' : 'Phone numbers and hours are shown only where OpenStreetMap has them; availability is not guaranteed.'}
        </p>
      </div>
    </div>
  );
};
