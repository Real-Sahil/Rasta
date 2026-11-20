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
    <div className="space-y-4">
      {/* Emergency Header */}
      <div className="space-y-2">
        <p className="ui-sub">{t.emergencySubtitle}</p>

        {/* SOS WhatsApp Share Button */}
        <button
          type="button"
          onClick={handleShareSos}
          className="ui-btn ui-btn-primary w-full h-12 text-[15px]"
        >
          <MessageCircle className="w-5 h-5" />
          <span>{isRtl ? 'واٹس ایپ پر اپنا مقام بھیجیں' : 'Send my location on WhatsApp'}</span>
        </button>
      </div>

      {/* Official Emergency Contact Helplines */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {EMERGENCY_CONTACTS.map((contact) => (
          <a
            key={contact.id}
            href={`tel:${contact.number}`}
            className="p-3.5 rounded-[20px] bg-[color:var(--paper)] ring-1 ring-[color:var(--line)] active:scale-[0.98] transition-transform flex flex-col justify-between group"
          >
            <div>
              <span className="text-xs font-bold text-[color:var(--ink)] block">
                {isRtl ? contact.titleUrdu : contact.title}
              </span>
              <p className="text-[10px] text-[color:var(--ink-2)] mt-0.5 line-clamp-1">
                {isRtl ? contact.descriptionUrdu : contact.description}
              </p>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[color:var(--line)]">
              <span className="font-display num text-[22px] font-extrabold text-[color:var(--danger)] leading-none">
                {contact.number}
              </span>
              <span className="ui-btn ui-btn-danger w-8 h-8 p-0"><PhoneCall className="w-4 h-4" /></span>
            </div>
          </a>
        ))}
      </div>

      {/* Local Road Services (Petrol, Puncture, Mechanics, Hospitals) */}
      <div className="space-y-2 pt-2 border-t border-[color:var(--line)]">
        <div className="flex items-center justify-between">
          <span className="font-display font-extrabold text-[15px] text-[color:var(--ink)]">
            {t.nearbyServices}
          </span>
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5">
            {([['hospital', isRtl ? 'ہسپتال' : 'Hospitals'], ['fuel', isRtl ? 'پٹرول' : 'Fuel']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveFilter(id)}
                aria-pressed={activeFilter === id}
                className="ui-chip"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {services.length === 0 && (
            <p className="text-xs text-[color:var(--ink-2)] p-2">
              {isRtl ? 'اس وقت ڈیٹا دستیاب نہیں۔' : 'No place data available yet.'}
            </p>
          )}
          {services.map(({ p, d }) => (
            <div
              key={p.id}
              onClick={() => onFocusLocation && onFocusLocation({ lat: p.lat, lng: p.lng })}
              className="px-3 py-2.5 rounded-[18px] bg-[color:var(--paper)] hover:ring-1 hover:ring-[color:var(--line)] transition-shadow cursor-pointer flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[color:var(--surface)] ring-1 ring-[color:var(--line)] flex items-center justify-center shrink-0">
                  {p.kind === 'fuel' ? <Fuel className="w-4 h-4 text-emerald-600" /> : <Hospital className="w-4 h-4 text-rose-600" />}
                </div>
                <div className="min-w-0">
                  <h5 className="font-bold text-xs sm:text-sm text-[color:var(--ink)] truncate">{stationName(p, isRtl)}</h5>
                  <p className="text-[11px] text-[color:var(--ink-2)] truncate">
                    {[d != null ? (d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`) : null, p.address, p.emergency ? (isRtl ? 'ایمرجنسی' : 'Emergency') : null, p.open24h ? '24/7' : null].filter(Boolean).join(' • ')}
                  </p>
                </div>
              </div>
              {p.phone && (
                <a
                  href={`tel:${p.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="ui-btn ui-btn-soft h-8 px-3 text-xs shrink-0"
                >
                  <PhoneCall className="w-3 h-3" />
                  <span>{isRtl ? 'کال' : 'Call'}</span>
                </a>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[color:var(--ink-2)]">
          {OSM_CREDIT}{OSM_UPDATED ? `, updated ${OSM_UPDATED}` : ''}. {isRtl ? 'فون نمبر اور اوقات صرف جہاں معلوم ہوں۔' : 'Phone numbers and hours are shown only where OpenStreetMap has them; availability is not guaranteed.'}
        </p>
      </div>
    </div>
  );
};
