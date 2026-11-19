/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { request, authed } from './incidentsApi';

export type ReportKind = 'fare' | 'delay';
export type ReportMode = 'metrobus' | 'orange_line' | 'bus' | 'van' | 'rickshaw' | 'taxi' | 'ride_hail';
export const REPORT_MODES: ReportMode[] = ['metrobus', 'orange_line', 'bus', 'van', 'rickshaw', 'taxi', 'ride_hail'];
/** Cities the backend accepts. Anything else (e.g. a custom area) cannot be reported or looked up. */
export const REPORT_CITIES = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'multan', 'faisalabad'];

export interface TransitStat { kind: ReportKind; mode: ReportMode; n: number; devices: number; median: number; p25: number; p75: number }

export const fetchTransitStats = async (city: string): Promise<TransitStat[]> =>
  (await request(`transit_stats&city=${encodeURIComponent(city)}`)).stats as TransitStat[];

export const sendTransitReport = async (r: { city: string; kind: ReportKind; mode: ReportMode; value: number }): Promise<void> =>
  void (await authed('transit_report', r));
