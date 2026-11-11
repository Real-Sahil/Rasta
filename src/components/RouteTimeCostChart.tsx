/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { RouteOption, TravelMode } from '../types';
import {
  CURRENT_PETROL_PRICE_PKR,
  MOTORBIKE_KM_PER_LITER,
  CAR_KM_PER_LITER
} from '../services/fareCalculator';
import {
  TrendingUp,
  Clock,
  Coins,
  Sparkles,
  Zap,
  Info,
  BarChart3,
  ScatterChart,
  ArrowRight
} from 'lucide-react';

export interface RouteCostPoint {
  route: RouteOption;
  timeMinutes: number;
  fuelCostPkr: number;
  tollCostPkr: number;
  totalCostPkr: number;
  speedKmh: number;
  isFastest: boolean;
  isCheapest: boolean;
  color: string;
}

interface RouteTimeCostChartProps {
  routes: RouteOption[];
  activeRoute: RouteOption | null;
  onSelectRoute: (route: RouteOption) => void;
  travelMode: TravelMode;
  isRtl?: boolean;
}

export const RouteTimeCostChart: React.FC<RouteTimeCostChartProps> = ({
  routes,
  activeRoute,
  onSelectRoute,
  travelMode,
  isRtl = false
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<'scatter' | 'bars'>('scatter');
  const [hoveredPoint, setHoveredPoint] = useState<RouteCostPoint | null>(null);

  // Compute calculated financial costs and time metrics per route based on TravelMode
  const chartData: RouteCostPoint[] = useMemo(() => {
    if (!routes || routes.length === 0) return [];

    const computed = routes.map((route, idx) => {
      const distance = Math.max(0.5, route.distanceKm);
      const time = Math.max(1, route.durationMinutes);
      let fuelCost = 0;
      let tollCost = route.hasTolls ? route.tollCostPkr || 60 : 0;

      if (travelMode === 'DRIVING') {
        const liters = distance / CAR_KM_PER_LITER;
        fuelCost = Math.round(liters * CURRENT_PETROL_PRICE_PKR);
      } else if (travelMode === 'TWO_WHEELER') {
        const liters = distance / MOTORBIKE_KM_PER_LITER;
        fuelCost = Math.round(liters * CURRENT_PETROL_PRICE_PKR);
        // Motorcycles rarely pay car tolls on urban expressways
        tollCost = 0;
      } else if (travelMode === 'TRANSIT') {
        // Flat PMA Metrobus or variable Orange Line train fare
        fuelCost = distance > 8 ? 40 : 30;
        tollCost = 0;
      } else if (travelMode === 'WALKING') {
        fuelCost = 0;
        tollCost = 0;
      }

      const totalCost = fuelCost + tollCost;
      const speedKmh = Math.round((distance / (time / 60)) || 35);

      // Distinct visual color mapping per route
      const colorPalette = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];
      const color = route.isRecommended ? '#10b981' : colorPalette[idx % colorPalette.length];

      return {
        route,
        timeMinutes: time,
        fuelCostPkr: fuelCost,
        tollCostPkr: tollCost,
        totalCostPkr: totalCost,
        speedKmh,
        isFastest: false,
        isCheapest: false,
        color
      };
    });

    if (computed.length > 0) {
      const minTime = Math.min(...computed.map((c) => c.timeMinutes));
      const minCost = Math.min(...computed.map((c) => c.totalCostPkr));
      computed.forEach((c) => {
        if (c.timeMinutes === minTime) c.isFastest = true;
        if (c.totalCostPkr === minCost) c.isCheapest = true;
      });
    }

    return computed;
  }, [routes, travelMode]);

  // Active point
  const activePoint = useMemo(() => {
    return chartData.find((d) => d.route.id === activeRoute?.id) || chartData[0];
  }, [chartData, activeRoute]);

  // Tradeoff analysis between the fastest and cheapest route
  const tradeOffVerdict = useMemo(() => {
    if (chartData.length < 2) return null;
    const fastest = chartData.find((c) => c.isFastest) || chartData[0];
    const cheapest = chartData.find((c) => c.isCheapest) || chartData[1];

    if (fastest.route.id === cheapest.route.id) {
      return {
        type: 'ideal' as const,
        en: `Route "${fastest.route.title.split('(')[0]}" is both the fastest and the most economical choice.`,
        ur: `راستہ "${fastest.route.titleUrdu.split('(')[0]}" تیز ترین اور سستا ترین دونوں ہے!`
      };
    }

    const timeDiffMinutes = cheapest.timeMinutes - fastest.timeMinutes;
    const costDiffPkr = fastest.totalCostPkr - cheapest.totalCostPkr;
    const costPerMinute = timeDiffMinutes > 0 ? (costDiffPkr / timeDiffMinutes).toFixed(1) : '0';

    return {
      type: 'tradeoff' as const,
      timeDiffMinutes,
      costDiffPkr,
      costPerMinute,
      fastestRoute: fastest.route,
      cheapestRoute: cheapest.route,
      en: `Saving ${timeDiffMinutes} mins via ${fastest.route.via} costs Rs. ${costDiffPkr} extra (~Rs. ${costPerMinute}/min saved).`,
      ur: `${fastest.route.viaUrdu} سے ${timeDiffMinutes} منٹ بچانے پر ${costDiffPkr} روپے اضافی خرچ ہوں گے (~${costPerMinute} روپے فی منٹ)۔`
    };
  }, [chartData]);

  // Render D3 Scatter Chart
  useEffect(() => {
    if (!svgRef.current || chartData.length === 0 || viewMode !== 'scatter') return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 420;
    const height = 210;
    const margin = { top: 25, right: 35, bottom: 42, left: 52 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Extents with padding for visual breathing room
    const times = chartData.map((d) => d.timeMinutes);
    const costs = chartData.map((d) => d.totalCostPkr);

    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timePadding = Math.max(2, (maxTime - minTime) * 0.35 || 4);

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const costPadding = Math.max(15, (maxCost - minCost) * 0.35 || 30);

    // X Scale: Travel Duration (Minutes)
    const xScale = d3
      .scaleLinear()
      .domain([Math.max(1, minTime - timePadding), maxTime + timePadding])
      .range([0, innerWidth]);

    // Y Scale: Financial Cost (PKR)
    const yScale = d3
      .scaleLinear()
      .domain([Math.max(0, minCost - costPadding), maxCost + costPadding])
      .range([innerHeight, 0]);

    // Background Gradient Quadrants
    const defs = svg.append('defs');
    const bgGradient = defs
      .append('linearGradient')
      .attr('id', 'timeCostBg')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    bgGradient.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', '0.08');
    bgGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', '0.03');

    // Background Rect
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('rx', 8)
      .attr('fill', 'url(#timeCostBg)')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-dasharray', '2,2')
      .attr('stroke-width', 0.8)
      .attr('class', 'dark:stroke-slate-800');

    // Ideal Zone label (Bottom-Left)
    g.append('text')
      .attr('x', 8)
      .attr('y', innerHeight - 8)
      .attr('fill', '#059669')
      .attr('font-size', '9px')
      .attr('font-weight', '700')
      .attr('opacity', 0.8)
      .text(isRtl ? '★ بہترین (کم وقت + کم خرچ)' : '★ Ideal: Fast & Budget');

    // Grid lines (horizontal)
    const yAxisGrid = d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => '').ticks(4);
    g.append('g')
      .attr('class', 'grid')
      .call(yAxisGrid)
      .selectAll('line')
      .attr('stroke', '#f1f5f9')
      .attr('stroke-dasharray', '3,3')
      .attr('class', 'dark:stroke-slate-800/80');
    g.select('.grid .domain').remove();

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(5)
      .tickFormat((d) => `${d}m`);

    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisGroup.select('.domain').attr('stroke', '#cbd5e1').attr('class', 'dark:stroke-slate-700');
    xAxisGroup.selectAll('text').attr('fill', '#64748b').attr('font-size', '10px');

    // X Axis Title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 34)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .text(isRtl ? 'سفر کا وقت (منٹ) ⏱️' : 'Travel Duration (Minutes) ⏱️');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickFormat((d) => `Rs ${d}`);

    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.select('.domain').attr('stroke', '#cbd5e1').attr('class', 'dark:stroke-slate-700');
    yAxisGroup.selectAll('text').attr('fill', '#64748b').attr('font-size', '10px');

    // Y Axis Title
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .text(isRtl ? 'کل تخمینہ خرچ (روپے) ₨' : 'Total Travel Cost (PKR) ₨');

    // Dotted tradeoff connector line between points
    if (chartData.length >= 2) {
      const lineGen = d3
        .line<RouteCostPoint>()
        .x((d) => xScale(d.timeMinutes))
        .y((d) => yScale(d.totalCostPkr))
        .curve(d3.curveMonotoneX);

      // Sort points by time
      const sortedByTime = [...chartData].sort((a, b) => a.timeMinutes - b.timeMinutes);

      g.append('path')
        .datum(sortedByTime)
        .attr('fill', 'none')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.6)
        .attr('d', lineGen);
    }

    // Interactive Nodes for each route
    chartData.forEach((point) => {
      const cx = xScale(point.timeMinutes);
      const cy = yScale(point.totalCostPkr);
      const isSelected = point.route.id === activeRoute?.id;

      const nodeGroup = g
        .append('g')
        .attr('class', 'route-node cursor-pointer')
        .attr('tabindex', 0)
        .on('click', () => {
          onSelectRoute(point.route);
        })
        .on('mouseenter', () => {
          setHoveredPoint(point);
        })
        .on('mouseleave', () => {
          setHoveredPoint(null);
        });

      // Active Route Pulsing Outer Circle
      if (isSelected) {
        nodeGroup
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 16)
          .attr('fill', point.color)
          .attr('opacity', 0.25)
          .append('animate')
          .attr('attributeName', 'r')
          .attr('values', '12;20;12')
          .attr('dur', '2s')
          .attr('repeatCount', 'indefinite');

        nodeGroup
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 12)
          .attr('fill', 'none')
          .attr('stroke', point.color)
          .attr('stroke-width', 2);
      }

      // Base Circle
      nodeGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', isSelected ? 8 : 6.5)
        .attr('fill', point.color)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2.5)
        .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))');

      // Label background pill
      const labelText = `${point.timeMinutes}m • Rs ${point.totalCostPkr}`;
      const textY = cy - (isSelected ? 16 : 13);

      const labelGroup = nodeGroup.append('g');

      labelGroup
        .append('text')
        .attr('x', cx)
        .attr('y', textY)
        .attr('text-anchor', 'middle')
        .attr('fill', isSelected ? point.color : '#334155')
        .attr('font-size', isSelected ? '10px' : '9px')
        .attr('font-weight', isSelected ? '800' : '600')
        .attr('class', 'dark:fill-slate-200 select-none')
        .text(labelText);

      // Route badge (Fastest / Cheapest)
      if (point.isFastest || point.isCheapest) {
        const badgeText = point.isFastest && point.isCheapest
          ? (isRtl ? 'بہترین' : 'Best')
          : point.isFastest
          ? (isRtl ? 'تیز ترین' : 'Fastest')
          : (isRtl ? 'سستا ترین' : 'Cheapest');

        labelGroup
          .append('text')
          .attr('x', cx)
          .attr('y', cy + 18)
          .attr('text-anchor', 'middle')
          .attr('fill', point.isFastest ? '#059669' : '#2563eb')
          .attr('font-size', '8.5px')
          .attr('font-weight', '700')
          .text(badgeText);
      }
    });
  }, [chartData, activeRoute, viewMode, isRtl, onSelectRoute]);

  if (!routes || routes.length === 0) return null;

  return (
    <div className="bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-xs">
      {/* Header with Title and Mode Switcher */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{isRtl ? 'وقت بمقابلہ خرچ تجزیہ' : 'Time vs. Cost Matrix'}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold">
                D3
              </span>
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isRtl
                ? 'بہترین معاشی اور تیز رفتار فیصلے کے لیے روٹس کا تقابل'
                : 'Interactive tradeoff chart for faster commute decisions'}
            </p>
          </div>
        </div>

        {/* View Switcher: Scatter Matrix vs Comparison Bars */}
        <div className="flex items-center bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setViewMode('scatter')}
            className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
              viewMode === 'scatter'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="D3 Scatter Plot Matrix"
          >
            <ScatterChart className="w-3 h-3" />
            <span className="hidden sm:inline">{isRtl ? 'میٹروکس' : 'Matrix'}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('bars')}
            className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
              viewMode === 'bars'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Comparative Side-by-Side Bars"
          >
            <BarChart3 className="w-3 h-3" />
            <span className="hidden sm:inline">{isRtl ? 'تقابل' : 'Bars'}</span>
          </button>
        </div>
      </div>

      {/* Main D3 Chart Display */}
      {viewMode === 'scatter' ? (
        <div ref={containerRef} className="relative w-full overflow-hidden flex flex-col items-center">
          <svg
            ref={svgRef}
            className="w-full max-w-[440px] h-auto overflow-visible select-none"
            aria-label="D3 Time vs Cost Scatter Plot"
          />

          {/* Interactive Hover / Selection Callout */}
          {hoveredPoint && (
            <div className="absolute top-2 right-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 text-[11px] space-y-1 pointer-events-none transition-all z-20 max-w-[200px]">
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {isRtl ? hoveredPoint.route.titleUrdu : hoveredPoint.route.title}
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[10px]">
                <span>{isRtl ? 'مدت:' : 'Time:'}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {hoveredPoint.timeMinutes} {isRtl ? 'منٹ' : 'mins'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[10px]">
                <span>{isRtl ? 'کل خرچ:' : 'Total Cost:'}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  Rs. {hoveredPoint.totalCostPkr}
                </span>
              </div>
              {hoveredPoint.tollCostPkr > 0 && (
                <div className="text-[9px] text-amber-600 dark:text-amber-400">
                  {isRtl ? `ٹول ٹیکس: ${hoveredPoint.tollCostPkr} روپے شامل` : `Includes Rs. ${hoveredPoint.tollCostPkr} Toll`}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Alternative Side-by-Side Comparison Bars */
        <div className="space-y-2 py-1">
          {chartData.map((item) => {
            const isSelected = item.route.id === activeRoute?.id;
            const maxCost = Math.max(...chartData.map((c) => c.totalCostPkr)) || 1;
            const maxTime = Math.max(...chartData.map((c) => c.timeMinutes)) || 1;

            const costWidthPercent = Math.round((item.totalCostPkr / maxCost) * 100);
            const timeWidthPercent = Math.round((item.timeMinutes / maxTime) * 100);

            return (
              <div
                key={item.route.id}
                onClick={() => onSelectRoute(item.route)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">
                      {isRtl ? item.route.viaUrdu : item.route.via}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.isFastest && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                        {isRtl ? 'تیز ترین' : 'Fastest'}
                      </span>
                    )}
                    {item.isCheapest && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                        {isRtl ? 'سستا' : 'Cheapest'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Duration Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {isRtl ? 'سفر کا دورانیہ:' : 'Duration:'}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {item.timeMinutes} {isRtl ? 'منٹ' : 'mins'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${timeWidthPercent}%` }}
                    />
                  </div>
                </div>

                {/* Cost Bar */}
                <div className="space-y-1 mt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3 text-amber-500" />
                      {isRtl ? 'کل خرچ:' : 'Estimated Cost:'}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      Rs. {item.totalCostPkr}
                      {item.tollCostPkr > 0 && (
                        <span className="text-[9px] text-slate-400 font-normal ml-1">
                          (incl. toll Rs {item.tollCostPkr})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${costWidthPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Financial & Time Decision Card */}
      {tradeOffVerdict && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-slate-800 dark:text-slate-200 text-[11px] flex items-start gap-2">
          <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
              {isRtl ? 'ذہین فیصلہ ساز مشورہ:' : 'Mobility Intelligence Insight:'}
            </span>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {isRtl ? tradeOffVerdict.ur : tradeOffVerdict.en}
            </p>
          </div>
        </div>
      )}

      {/* Fuel Benchmark Reference Footer */}
      <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
        <span>
          {isRtl
            ? `پٹرول ریٹ: ${CURRENT_PETROL_PRICE_PKR} روپے / لیٹر (لاہور مارکیٹ)`
            : `Petrol benchmark: Rs. ${CURRENT_PETROL_PRICE_PKR}/L (Lahore standard)`}
        </span>
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {travelMode === 'DRIVING'
            ? 'Car 13.5 km/L'
            : travelMode === 'TWO_WHEELER'
            ? 'Bike 48.0 km/L'
            : travelMode === 'TRANSIT'
            ? 'PMA Fixed Fare'
            : 'Zero Fuel'}
        </span>
      </div>
    </div>
  );
};
