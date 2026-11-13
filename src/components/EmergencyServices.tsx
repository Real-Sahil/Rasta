/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EMERGENCY_CONTACTS, LOCAL_SERVICES } from '../data/pakistanLocations';
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'petrol' | 'puncture' | 'hospital'>('all');

  const filteredServices = activeFilter === 'all'
    ? LOCAL_SERVICES
    : LOCAL_SERVICES.filter(s => s.type === activeFilter);

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
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2 py-0.5 rounded-lg font-semibold ${
                activeFilter === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('puncture')}
              className={`px-2 py-0.5 rounded-lg font-semibold ${
                activeFilter === 'puncture' ? 'bg-emerald-600 text-white' : 'text-slate-500'
              }`}
            >
              {isRtl ? 'پنکچر' : 'Puncture'}
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('petrol')}
              className={`px-2 py-0.5 rounded-lg font-semibold ${
                activeFilter === 'petrol' ? 'bg-emerald-600 text-white' : 'text-slate-500'
              }`}
            >
              {isRtl ? 'پٹرول' : 'Fuel'}
            </button>
          </div>
        </div>

        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              onClick={() => onFocusLocation && onFocusLocation({ lat: service.lat, lng: service.lng })}
              className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-700 shadow-xs text-slate-600 dark:text-slate-300">
                  {service.type === 'petrol' && <Fuel className="w-4 h-4 text-emerald-600" />}
                  {service.type === 'puncture' && <Wrench className="w-4 h-4 text-amber-500" />}
                  {service.type === 'hospital' && <Hospital className="w-4 h-4 text-rose-600" />}
                </div>

                <div>
                  <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                    {isRtl ? service.nameUrdu : service.name}
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isRtl ? service.addressUrdu : service.address}
                  </p>
                </div>
              </div>

              {service.phone && (
                <a
                  href={`tel:${service.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1 hover:bg-emerald-100"
                >
                  <PhoneCall className="w-3 h-3" />
                  <span>Call</span>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
