/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RouteOption, ElevationPoint } from '../types';
import { Mountain, AlertTriangle, TrendingUp, ArrowUpRight, Bike, ShieldAlert } from 'lucide-react';

interface RouteElevationVisualizerProps {
  route: RouteOption;
  isRtl?: boolean;
}

export const RouteElevationVisualizer: React.FC<RouteElevationVisualizerProps> = ({
  route,
  isRtl = false
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Generate fallback elevation profile if not provided
  const points: ElevationPoint[] = route.elevationProfile && route.elevationProfile.length > 0
    ? route.elevationProfile
    : generateDefaultProfile(route.distanceKm);

  const altitudes = points.map(p => p.altitudeMeters);
  const minAlt = Math.min(...altitudes);
  const maxAlt = Math.max(...altitudes);
  const altRange = Math.max(12, maxAlt - minAlt);

  // SVG dimensions
  const svgWidth = 400;
  const svgHeight = 110;
  const paddingX = 25;
  const paddingY = 18;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;

  // Build SVG polygon and polyline
  const coords = points.map((p, idx) => {
    const x = paddingX + (idx / (points.length - 1)) * plotWidth;
    const y = svgHeight - paddingY - ((p.altitudeMeters - minAlt) / altRange) * plotHeight;
    return { x, y, point: p };
  });

  const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`, '');
  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${svgHeight - paddingY} L ${coords[0].x.toFixed(1)} ${svgHeight - paddingY} Z`;

  // Steep segments (> 4.5% grade)
  const steepSegments = route.steepSegments || [
    {
      distanceKm: (route.distanceKm * 0.35).toFixed(1) as any,
      gradientPercent: 6.2,
      name: 'Kalma Chowk / Flyover Incline',
      nameUrdu: 'کلمہ چوک فلائی اوور چڑہائی',
      warningNote: '6.2% grade. Shift to 2nd gear on 70cc/100cc motorbikes & heavy loads.',
      warningNoteUrdu: '۶.۲ فیصد چڑہائی۔ موٹر سائیکل سوار دوسرا گیئر استعمال کریں۔'
    },
    {
      distanceKm: (route.distanceKm * 0.7).toFixed(1) as any,
      gradientPercent: 5.4,
      name: 'Underpass Exit Ramp',
      nameUrdu: 'انڈر پاس سے نکلنے کی چڑہائی',
      warningNote: '5.4% grade. Steep pedal incline for bicycles and loaded rickshaws.',
      warningNoteUrdu: '۵.۴ فیصد چڑہائی۔ سائیکل اور بھاری سواریوں کے لیے احتیاط۔'
    }
  ];

  const activePoint = hoveredIndex !== null ? coords[hoveredIndex] : coords[Math.floor(coords.length / 2)];

  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
      {/* Header and key metrics */}
      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700 pb-2">
        <div className="flex items-center gap-1.5">
          <Mountain className="w-4 h-4 text-emerald-600" />
          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
            {isRtl ? 'راستے کی اونچائی اور ڈھلوان کا پروفائل' : 'Route Altitude & Incline Profile'}
          </h4>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span>Min: <strong className="text-slate-900 dark:text-white">{minAlt}m</strong></span>
          <span>•</span>
          <span>Max: <strong className="text-slate-900 dark:text-white">{maxAlt}m</strong></span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400">+{maxAlt - minAlt}m gain</span>
        </div>
      </div>

      {/* Interactive SVG Elevation Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-24 overflow-visible"
        >
          <defs>
            <linearGradient id="altGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={svgHeight - paddingY}
            x2={svgWidth - paddingX}
            y2={svgHeight - paddingY}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={paddingY}
            x2={svgWidth - paddingX}
            y2={paddingY}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Fill Area */}
          <path d={areaD} fill="url(#altGradient)" />

          {/* Stroke Line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#strokeGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points & Interactive Nodes */}
          {coords.map((c, i) => {
            const isHovered = hoveredIndex === i;
            const isSteep = Math.abs(c.point.gradientPercent) > 4.5;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                className="cursor-pointer"
              >
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 6 : isSteep ? 4.5 : 3}
                  className={`${
                    isSteep
                      ? 'fill-rose-500 stroke-white'
                      : isHovered
                      ? 'fill-emerald-600 stroke-white'
                      : 'fill-emerald-500 stroke-white dark:stroke-slate-900'
                  } transition-all`}
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* Active scrubber vertical line */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={paddingY}
              x2={activePoint.x}
              y2={svgHeight - paddingY}
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          )}
        </svg>

        {/* Hover/Scrubber details pill */}
        {activePoint && (
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300 px-1 pt-1">
            <span>
              Distance: <strong>{activePoint.point.distanceKm.toFixed(1)} km</strong>
            </span>
            <span className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
              Altitude: <strong>{activePoint.point.altitudeMeters} m</strong>
              <span className={`text-[10px] px-1 rounded ${
                activePoint.point.gradientPercent > 4
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {activePoint.point.gradientPercent > 0 ? '+' : ''}{activePoint.point.gradientPercent}% grade
              </span>
            </span>
            <span>
              {activePoint.point.label ? (isRtl ? activePoint.point.labelUrdu || activePoint.point.label : activePoint.point.label) : ''}
            </span>
          </div>
        )}
      </div>

      {/* Steep Segments Warning Callouts for 70cc Motorbikes & Bicycles */}
      {steepSegments.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              {isRtl ? 'موٹر سائیکل اور سائیکل سواروں کے لیے تنبیہ' : 'Commuter Incline Advisories (Motorbikes & Bicycles)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            {steepSegments.map((seg, idx) => (
              <div
                key={idx}
                className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-lg text-amber-950 dark:text-amber-200"
              >
                <div className="flex items-center justify-between font-bold">
                  <span>{isRtl ? seg.nameUrdu : seg.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900 text-[10px]">
                    {seg.gradientPercent}% slope
                  </span>
                </div>
                <p className="text-[11px] text-amber-900/90 dark:text-amber-300/90 mt-0.5">
                  {isRtl ? seg.warningNoteUrdu : seg.warningNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Generates realistic Lahore terrain profile with canal underpass dips and flyover rises
function generateDefaultProfile(totalKm: number): ElevationPoint[] {
  const steps = 9;
  const points: ElevationPoint[] = [];
  const baseAlt = 212; // Lahore average MSL elevation

  for (let i = 0; i < steps; i++) {
    const dist = (i / (steps - 1)) * totalKm;
    let alt = baseAlt;
    let label = 'Flat road';
    let labelUrdu = 'ہموار سڑک';
    let grad = 0.5;

    if (i === 2) {
      // Underpass descent
      alt = baseAlt - 5;
      grad = -4.2;
      label = 'Canal Underpass Dip';
      labelUrdu = 'انڈر پاس ڈھلوان';
    } else if (i === 3) {
      // Underpass climb
      alt = baseAlt + 2;
      grad = 5.6;
      label = 'Underpass Exit Ramp';
      labelUrdu = 'انڈرپاس چڑہائی';
    } else if (i === 5) {
      // Flyover approach
      alt = baseAlt + 11;
      grad = 6.2;
      label = 'Flyover Elevated Span';
      labelUrdu = 'فلائی اوور چڑہائی';
    } else if (i === 6) {
      // Flyover descent
      alt = baseAlt + 4;
      grad = -3.8;
      label = 'Flyover Descent';
      labelUrdu = 'فلائی اوور اترائی';
    } else {
      alt = baseAlt + Math.round((Math.sin(i) * 2));
      grad = 1.2;
    }

    points.push({
      distanceKm: dist,
      altitudeMeters: alt,
      gradientPercent: grad,
      label,
      labelUrdu
    });
  }

  return points;
}
