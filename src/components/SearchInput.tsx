/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Navigation, Train, Bus, AlertCircle, Loader2, Mic, MicOff, Radio } from 'lucide-react';
import { LocationPoint } from '../types';
import { POPULAR_LOCATIONS, METROBUS_STATIONS, ORANGELINE_STATIONS } from '../data/pakistanLocations';
import { translations } from '../data/locales';
import { useVoiceInput } from '../services/speechRecognition';

interface SearchInputProps {
  language: 'en' | 'ur' | 'pa' | 'ar';
  placeholder?: string;
  onSelectLocation: (location: LocationPoint) => void;
  onUseCurrentLocation?: () => void;
  currentCoords?: { lat: number; lng: number } | null;
  initialValue?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  language,
  placeholder,
  onSelectLocation,
  onUseCurrentLocation,
  currentCoords,
  initialValue = ''
}) => {
  const [query, setQuery] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState<LocationPoint[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = translations[language];
  const isUrdu = language === 'ur' || language === 'pa';

  // Voice recognition for hands-free driver search
  const {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    errorMessage: voiceError
  } = useVoiceInput((finalText) => {
    setQuery(finalText);
    setIsOpen(true);
  });

  // Toggle voice recognition
  const handleToggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      // Pass ur-PK if Urdu or Punjabi, otherwise en-US
      startListening(isUrdu ? 'ur-PK' : 'en-US');
    }
  };

  // Detect if user is typing in Urdu/Arabic script
  const isInputUrdu = /[\u0600-\u06FF]/.test(query);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Synchronize initialValue changes
  useEffect(() => {
    if (initialValue) {
      setQuery(initialValue);
    }
  }, [initialValue]);

  // Combined local dataset for instantaneous offline-first lookups in Lahore
  const localDataset: LocationPoint[] = [
    ...POPULAR_LOCATIONS,
    ...METROBUS_STATIONS.map(s => ({
      id: s.id,
      name: `${s.name} (Metrobus)`,
      nameUrdu: `${s.nameUrdu} (میٹرو بس)`,
      lat: s.lat,
      lng: s.lng,
      address: `Metrobus Line Station ${s.code}`,
      addressUrdu: `میٹرو بس اسٹیشن ${s.code}`,
      category: 'metro' as const
    })),
    ...ORANGELINE_STATIONS.map(s => ({
      id: s.id,
      name: `${s.name} (Orange Line)`,
      nameUrdu: `${s.nameUrdu} (اورنج لائن)`,
      lat: s.lat,
      lng: s.lng,
      address: `Orange Line Rapid Transit ${s.code}`,
      addressUrdu: `اورنج لائن میٹرو اسٹیشن ${s.code}`,
      category: 'orangeline' as const
    }))
  ];

  // Local filtering based on query
  const localMatches = query.trim() === ''
    ? localDataset.slice(0, 5)
    : localDataset.filter(loc => {
        const q = query.toLowerCase().trim();
        return (
          loc.name.toLowerCase().includes(q) ||
          loc.nameUrdu.includes(query.trim()) ||
          (loc.address && loc.address.toLowerCase().includes(q)) ||
          (loc.addressUrdu && loc.addressUrdu.includes(query.trim()))
        );
      }).slice(0, 6);

  // Online Geocoding Lookup via OpenStreetMap Nominatim for Pakistan
  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingOnline(true);
        // Restrict geocoding search to Pakistan (country code: pk)
        const encoded = encodeURIComponent(query.trim());
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encoded}&countrycodes=pk&format=json&addressdetails=1&limit=4`,
          {
            headers: {
              'Accept-Language': isInputUrdu ? 'ur,en;q=0.8' : 'en,ur;q=0.8'
            }
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mapped: LocationPoint[] = data.map((item: any, idx: number) => ({
              id: `geo_${item.place_id || idx}`,
              name: item.display_name.split(',')[0],
              nameUrdu: item.namedetails?.name_ur || item.display_name.split(',')[0],
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              address: item.display_name,
              addressUrdu: item.display_name,
              category: 'hub'
            }));
            setOnlineResults(mapped);
          }
        }
      } catch (err) {
        console.warn('Geocoding search failed, using local Pakistan points:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [query, isInputUrdu]);

  const handleSelect = (loc: LocationPoint) => {
    setQuery(isUrdu ? loc.nameUrdu : loc.name);
    setIsOpen(false);
    onSelectLocation(loc);
  };

  const handleClear = () => {
    setQuery('');
    setOnlineResults([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full z-40">
      <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
        <div className="p-3 text-slate-400 dark:text-slate-500 flex items-center justify-center">
          {isSearchingOnline ? (
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          dir={isInputUrdu ? 'rtl' : 'auto'}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || (isUrdu ? t.searchPlaceholder : 'Search Lahore chowks, metro, addresses...')}
          className={`w-full py-3 pr-2 text-sm md:text-base bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none ${
            isInputUrdu ? 'font-urdu font-medium text-right' : ''
          }`}
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Hands-Free Voice Search Button */}
        <button
          type="button"
          onClick={handleToggleVoice}
          className={`p-2 mx-1 rounded-xl transition-all relative ${
            isListening
              ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
              : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={isListening ? 'Stop Listening' : (isUrdu ? 'آواز سے منزل تلاش کریں' : 'Voice Search (Urdu & English)')}
        >
          {isListening ? <Radio className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
        </button>

        {onUseCurrentLocation && (
          <button
            type="button"
            onClick={() => {
              onUseCurrentLocation();
              setIsOpen(false);
            }}
            className="m-1.5 px-3 py-1.5 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition-all border border-emerald-200 dark:border-emerald-800"
            title={t.currentLocation}
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{t.currentLocation}</span>
          </button>
        )}
      </div>

      {/* Voice Recognition Live Listening Banner */}
      {isListening && (
        <div className="absolute top-full left-0 right-0 mt-1.5 p-2.5 bg-slate-900 text-white rounded-xl shadow-xl flex items-center justify-between gap-2 z-50 text-xs border border-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span className="font-semibold text-rose-300">
              {isUrdu ? 'سن رہا ہوں... (مثلاً: لبرٹی چوک یا کلمہ چوک بولیں)' : 'Listening hands-free... (Say Liberty Chowk or Kalma Chowk)'}
            </span>
          </div>
          {interimTranscript && (
            <span className="text-slate-300 italic truncate max-w-[150px]">
              "{interimTranscript}"
            </span>
          )}
          <button
            type="button"
            onClick={stopListening}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
          >
            Done
          </button>
        </div>
      )}

      {/* Voice Error Notice */}
      {voiceError && (
        <div className="absolute top-full left-0 right-0 mt-1.5 p-2 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs rounded-xl shadow-md z-50 flex items-center justify-between">
          <span>{voiceError}</span>
        </div>
      )}

      {/* Dropdown Suggestions */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-96 overflow-y-auto z-50">
          {/* Quick chips when input is empty */}
          {query.trim() === '' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                {isUrdu ? 'لاہور کے اہم چوک اور مقامات' : 'Popular Lahore Hubs'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_LOCATIONS.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                  >
                    {isUrdu ? item.nameUrdu : item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Local Matches */}
          {localMatches.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                {isUrdu ? 'لاہور موبیلیٹی نیٹ ورک' : 'Verified Pakistan Transit Hubs'}
              </div>
              {localMatches.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSelect(loc)}
                  className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-emerald-50 dark:hover:bg-slate-800 text-left transition-colors group"
                >
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors shrink-0">
                    {loc.category === 'metro' ? (
                      <Bus className="w-4 h-4 text-rose-600" />
                    ) : loc.category === 'orangeline' ? (
                      <Train className="w-4 h-4 text-amber-500" />
                    ) : (
                      <MapPin className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                        {isUrdu ? loc.nameUrdu : loc.name}
                      </span>
                      {loc.category === 'metro' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                          Metrobus
                        </span>
                      )}
                      {loc.category === 'orangeline' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                          Orange Line
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {isUrdu ? loc.addressUrdu || loc.address : loc.address}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Online Geocoded Results */}
          {onlineResults.length > 0 && (
            <div className="py-1 border-t border-slate-100 dark:border-slate-800">
              <div className="px-3 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                {isUrdu ? 'آن لائن نقشہ کے نتائج' : 'Geocoded Address Matches'}
              </div>
              {onlineResults.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSelect(loc)}
                  className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-emerald-50 dark:hover:bg-slate-800 text-left transition-colors"
                >
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                    <MapPin className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate block">
                      {loc.name}
                    </span>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{loc.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {localMatches.length === 0 && onlineResults.length === 0 && !isSearchingOnline && query.trim() !== '' && (
            <div className="p-4 text-center text-sm text-slate-500 flex flex-col items-center gap-1.5">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span>{isUrdu ? 'کوئی مقام نہیں ملا۔ براہ کرم املا چیک کریں۔' : 'No matching location found. Try searching a major chowk or station.'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
