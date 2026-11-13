/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = 'en' | 'ur' | 'pa' | 'ar';

export type MapProvider = 'google' | 'osm';

export type TravelMode = 'DRIVING' | 'TWO_WHEELER' | 'TRANSIT' | 'WALKING' | 'BICYCLING';

export type IncidentCategory = 
  | 'accident'
  | 'congestion'
  | 'closure'
  | 'construction'
  | 'flooding'
  | 'roadblock'
  | 'police_naka'
  | 'hazard';

export interface LocationPoint {
  id: string;
  name: string;
  nameUrdu: string;
  lat: number;
  lng: number;
  address?: string;
  addressUrdu?: string;
  category?: 'hub' | 'metro' | 'orangeline' | 'hospital' | 'fuel' | 'mechanic' | 'police';
}

export interface CommunityIncident {
  id: string;
  title: string;
  titleUrdu: string;
  category: IncidentCategory;
  locationName: string;
  locationNameUrdu: string;
  lat: number;
  lng: number;
  description: string;
  descriptionUrdu: string;
  timestamp: number;
  upvotes: number;
  userConfirmed: boolean;
  credibilityScore: number; // e.g. 94%
  isOfficialVerified: boolean;
  source: 'PSCA' | 'CTPL_Punjab' | 'Citizen_Report';
  alternativeRouteAdvice?: string;
  alternativeRouteAdviceUrdu?: string;
  photoUrl?: string;
  expiresAt: number;
}

export interface TransitStation {
  id: string;
  code: string;
  name: string;
  nameUrdu: string | null; // null = OpenStreetMap has no Urdu name; never machine-guessed
  line: 'metrobus' | 'orangeline' | 'speedo';
  lat: number;
  lng: number;
  osmId: string;
}

export interface ElevationPoint {
  distanceKm: number;
  altitudeMeters: number;
  gradientPercent: number;
  label?: string;
  labelUrdu?: string;
}

export interface RouteOption {
  id: string;
  title: string;
  titleUrdu: string;
  via: string;
  viaUrdu: string;
  distanceKm: number;
  durationMinutes: number;
  trafficStatus?: 'normal' | 'moderate' | 'heavy' | 'jam';
  hasTolls: boolean;
  tollCostPkr?: number;
  isRecommended: boolean;
  steps: NavigationStep[];
  pathCoordinates: { lat: number; lng: number }[];
  elevationProfile?: ElevationPoint[];
  maxElevationMeters?: number;
  minElevationMeters?: number;
  totalClimbMeters?: number;
  steepSegments?: {
    distanceKm: number;
    gradientPercent: number;
    name: string;
    nameUrdu: string;
    warningNote: string;
    warningNoteUrdu: string;
  }[];
}

export interface NavigationStep {
  instruction: string;
  instructionUrdu: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver: 'turn-left' | 'turn-right' | 'straight' | 'u-turn' | 'roundabout' | 'merge' | 'arrive';
}

export interface MultimodalCostComparison {
  mode: 'car' | 'motorbike' | 'rickshaw' | 'metrobus' | 'orangeline' | 'ride_hailing' | 'walking';
  title: string;
  titleUrdu: string;
  costPkr: number;
  durationMinutes: number;
  distanceKm: number;
  co2Grams: number;
  comfortRating: 1 | 2 | 3 | 4 | 5;
  highlights: string[];
  highlightsUrdu: string[];
  isCheapest?: boolean;
  isFastest?: boolean;
}

export interface EmergencyContact {
  id: string;
  title: string;
  titleUrdu: string;
  number: string;
  category: 'rescue' | 'police' | 'traffic' | 'motorway' | 'ambulance';
  description: string;
  descriptionUrdu: string;
}

/** Hospital or fuel station from OpenStreetMap. Unknown facts are null, never invented. */
export interface Poi {
  id: string;
  kind: 'hospital' | 'fuel';
  name: string;
  nameUrdu: string | null;
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  open24h: boolean | null;
  emergency: boolean | null;
  osmId: string;
}
