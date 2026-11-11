/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { RouteOption } from '../types';
import { LineChart, Activity, Clock, ShieldAlert } from 'lucide-react';

interface TrafficCongestionChartProps {
  route: RouteOption | null;
  isRtl?: boolean;
}

interface CongestionPoint {
  timeLabel: string;
  timeLabelUrdu: string;
  congestionPercent: number;
  statusText: string;
  statusTextUrdu: string;
}

export const TrafficCongestionChart: React.FC<TrafficCongestionChartProps> = ({
  route,
  isRtl = false
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Generate 60-minute predicted congestion data based on route traffic status
  const data: CongestionPoint[] = React.useMemo(() => {
    if (!route) return [];

    const baseLevel = route.trafficStatus === 'jam'
      ? 85
      : route.trafficStatus === 'heavy'
      ? 68
      : route.trafficStatus === 'moderate'
      ? 45
      : 22;

    const times = [
      { en: 'Now', ur: 'ابھی' },
      { en: '+10m', ur: '+۱۰ منٹ' },
      { en: '+20m', ur: '+۲۰ منٹ' },
      { en: '+30m', ur: '+۳۰ منٹ' },
      { en: '+40m', ur: '+۴۰ منٹ' },
      { en: '+50m', ur: '+۵۰ منٹ' },
      { en: '+60m', ur: '+۶۰ منٹ' }
    ];

    return times.map((t, idx) => {
      // Add realistic variance along the route timeline
      const variance = Math.sin(idx * 0.8) * 12 + (idx === 3 ? 15 : 0);
      const val = Math.min(98, Math.max(10, Math.round(baseLevel + variance)));
      const status = val > 75 ? 'Heavy Jam' : val > 50 ? 'Moderate Slowdown' : 'Smooth Flow';
      const statusUrdu = val > 75 ? 'شدید ٹریفک جام' : val > 50 ? 'درمیانی رفتار' : 'روانی جاری';

      return {
        timeLabel: t.en,
        timeLabelUrdu: t.ur,
        congestionPercent: val,
        statusText: status,
        statusTextUrdu: statusUrdu
      };
    });
  }, [route]);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 380;
    const height = 160;
    const margin = { top: 15, right: 20, bottom: 32, left: 36 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: Time Points
    const xScale = d3
      .scalePoint()
      .domain(data.map((d) => (isRtl ? d.timeLabelUrdu : d.timeLabel)))
      .range([0, innerWidth])
      .padding(0.1);

    // Y Scale: Congestion Percentage (0 to 100)
    const yScale = d3
      .scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0]);

    // Gradient Area Fill under the line
    const defs = svg.append('defs');
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'congestionGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', '0.35');
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', '0.02');

    // Area Generator
    const areaGen = d3
      .area<CongestionPoint>()
      .x((d) => xScale(isRtl ? d.timeLabelUrdu : d.timeLabel) || 0)
      .y0(innerHeight)
      .y1((d) => yScale(d.congestionPercent))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'url(#congestionGradient)')
      .attr('d', areaGen);

    // Grid lines (horizontal)
    const yAxisGrid = d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => '').ticks(4);
    g.append('g')
      .attr('class', 'grid')
      .call(yAxisGrid)
      .selectAll('line')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-dasharray', '2,2')
      .attr('class', 'dark:stroke-slate-800');
    g.select('.grid .domain').remove();

    // Line Generator
    const lineGen = d3
      .line<CongestionPoint>()
      .x((d) => xScale(isRtl ? d.timeLabelUrdu : d.timeLabel) || 0)
      .y((d) => yScale(d.congestionPercent))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.5)
      .attr('d', lineGen);

    // X Axis
    const xAxis = d3.axisBottom(xScale);
    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisGroup.select('.domain').attr('stroke', '#cbd5e1').attr('class', 'dark:stroke-slate-700');
    xAxisGroup.selectAll('text').attr('fill', '#64748b').attr('font-size', '9.5px').attr('font-weight', '600');

    // Y Axis
    const yAxis = d3.axisLeft(yScale).ticks(3).tickFormat((d) => `${d}%`);
    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.select('.domain').attr('stroke', '#cbd5e1').attr('class', 'dark:stroke-slate-700');
    yAxisGroup.selectAll('text').attr('fill', '#64748b').attr('font-size', '9.5px');

    // Data Circles
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(isRtl ? d.timeLabelUrdu : d.timeLabel) || 0)
      .attr('cy', (d) => yScale(d.congestionPercent))
      .attr('r', 4)
      .attr('fill', (d) => (d.congestionPercent > 70 ? '#ef4444' : d.congestionPercent > 45 ? '#f59e0b' : '#10b981'))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('class', 'transition-transform duration-200 hover:scale-150 cursor-pointer');

  }, [data, isRtl]);

  if (!route) return null;

  return (
    <div className="bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 space-y-2 shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-slate-900 dark:text-white">
              {isRtl ? 'اگلے 60 منٹ کا ٹریفک تخمینہ' : '60-Min Traffic Congestion Forecast'}
            </h5>
            <p className="text-[9.5px] text-slate-500 dark:text-slate-400">
              {isRtl ? `روٹ: ${route.viaUrdu}` : `Route: ${route.via}`}
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
          D3.js AI Forecast
        </span>
      </div>

      <div className="flex justify-center overflow-hidden">
        <svg ref={svgRef} className="w-full max-w-[380px] h-auto overflow-visible select-none" />
      </div>
    </div>
  );
};
