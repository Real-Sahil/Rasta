/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommunityIncident, LocationPoint } from '../types';
import { INITIAL_INCIDENTS, POPULAR_LOCATIONS } from '../data/pakistanLocations';

const STORAGE_KEYS = {
  INCIDENTS: 'rasta_pakistan_incidents_v2',
  SAVED_PLACES: 'rasta_pakistan_saved_places_v1',
  CACHED_AREAS: 'rasta_pakistan_offline_areas_v1',
  SETTINGS: 'rasta_pakistan_settings_v1'
};

export function getStoredIncidents(): CommunityIncident[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INCIDENTS);
    if (!raw) return INITIAL_INCIDENTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_INCIDENTS;
    return (parsed as CommunityIncident[]).filter((i) => !i.expiresAt || i.expiresAt > Date.now());
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
