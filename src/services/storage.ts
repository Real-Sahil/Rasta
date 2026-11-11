/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommunityIncident, LocationPoint } from '../types';
import { INITIAL_INCIDENTS, POPULAR_LOCATIONS } from '../data/pakistanLocations';

const STORAGE_KEYS = {
  INCIDENTS: 'rasta_pakistan_incidents_v1',
  SAVED_PLACES: 'rasta_pakistan_saved_places_v1',
  CACHED_AREAS: 'rasta_pakistan_offline_areas_v1',
  SETTINGS: 'rasta_pakistan_settings_v1'
};

export interface OfflineAreaPack {
  id: string;
  name: string;
  nameUrdu: string;
  sizeMb: number;
  downloadedAt: number | null;
  status: 'cached' | 'available' | 'downloading';
  bounds: { north: number; south: number; east: number; west: number };
}

export const PRESET_OFFLINE_AREAS: OfflineAreaPack[] = [
  {
    id: 'lahore_central',
    name: 'Lahore Central (Mall Rd, Gulberg, Mozang)',
    nameUrdu: 'لاہور سینٹرل (مال روڈ، گلبرگ، موزنگ)',
    sizeMb: 14.2,
    downloadedAt: Date.now() - 3600000,
    status: 'cached',
    bounds: { north: 31.59, south: 31.49, east: 74.37, west: 74.29 }
  },
  {
    id: 'lahore_dha_cantt',
    name: 'DHA Phase 1-6 & Lahore Cantt',
    nameUrdu: 'ڈی ایچ اے فیز ۱-۶ و کینٹ',
    sizeMb: 21.8,
    downloadedAt: null,
    status: 'available',
    bounds: { north: 31.54, south: 31.44, east: 74.45, west: 74.36 }
  },
  {
    id: 'lahore_johar_thokar',
    name: 'Johar Town, Raiwind Rd & Thokar',
    nameUrdu: 'جوہر ٹاؤن، رائیونڈ روڈ و ٹھوکر',
    sizeMb: 16.5,
    downloadedAt: null,
    status: 'available',
    bounds: { north: 31.49, south: 31.42, east: 74.31, west: 74.22 }
  }
];

export function getStoredIncidents(): CommunityIncident[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INCIDENTS);
    if (!raw) return INITIAL_INCIDENTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_INCIDENTS;
  } catch {
    return INITIAL_INCIDENTS;
  }
}

export function saveIncidents(incidents: CommunityIncident[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
  } catch (e) {
    console.error('Failed to save incidents to localStorage', e);
  }
}

export function getStoredSavedPlaces(): LocationPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_PLACES);
    if (!raw) return POPULAR_LOCATIONS.slice(0, 4);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : POPULAR_LOCATIONS.slice(0, 4);
  } catch {
    return POPULAR_LOCATIONS.slice(0, 4);
  }
}

export function saveStoredSavedPlaces(places: LocationPoint[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_PLACES, JSON.stringify(places));
  } catch (e) {
    console.error('Failed to save places to localStorage', e);
  }
}

export function getStoredOfflineAreas(): OfflineAreaPack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CACHED_AREAS);
    if (!raw) return PRESET_OFFLINE_AREAS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : PRESET_OFFLINE_AREAS;
  } catch {
    return PRESET_OFFLINE_AREAS;
  }
}

export function saveStoredOfflineAreas(areas: OfflineAreaPack[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CACHED_AREAS, JSON.stringify(areas));
  } catch (e) {
    console.error('Failed to save offline areas', e);
  }
}
