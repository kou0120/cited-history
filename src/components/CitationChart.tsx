"use client";

import React, { useMemo, useRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { toPng } from 'html-to-image';
import { Download } from 'lucide-react';
import { PaperData } from '@/lib/openalex';

interface CitationChartProps {
  data: PaperData[];
  logScale: boolean;
  alignTimeline: boolean;
  cumulative: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
  height?: number;
  frame?: boolean;
  animation?: boolean;
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'
];

export function CitationChart({ data, logScale, alignTimeline, cumulative, legendPosition, height = 500, frame = true, animation = true }: CitationChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const downloadImage = useCallback(() => {
    if (chartRef.current === null) {
      return;
    }

    toPng(chartRef.current, { 
      backgroundColor: '#ffffff', 
      cacheBust: true,
      skipFonts: true, // Fix "font is undefined" error by skipping font embedding
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `citation-history-${new Date().getTime()}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('oops, something went wrong!', err);
      });
  }, [chartRef]);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 1. Gather all years from all papers
    let allYears: number[] = [];
    data.forEach(paper => {
      paper.citations.forEach(c => allYears.push(c.year));
    });
    
    if (allYears.length === 0) return [];

    const minYear = Math.min(...allYears);
    const maxYear = Math.max(...allYears);
    const yearRange = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

    // 2. Build the data structure for Recharts
    // If alignTimeline is true, we treat the first year of each paper as year 0 (or 1)
    // If alignTimeline is false, we use actual calendar years

    if (alignTimeline) {
      // Align by relative year (0, 1, 2...)
      // We need to find the max duration
      let maxDuration = 0;
      data.forEach(paper => {
        if (paper.citations.length > 0) {
            const pMin = Math.min(...paper.citations.map(c => c.year));
            const pMax = Math.max(...paper.citations.map(c => c.year));
            maxDuration = Math.max(maxDuration, pMax - pMin);
        }
      });

      const result = [];
      for (let i = 0; i <= maxDuration; i++) {
        const point: any = { name: `Year ${i}` };
        data.forEach(paper => {
          if (paper.citations.length === 0) {
              // No data for this paper
              return;
          }
          const pMin = Math.min(...paper.citations.map(c => c.year));
          const pMax = Math.max(...paper.citations.map(c => c.year));
          
          // If the current relative year i exceeds the paper's lifespan, do not set a value (line break)
          if (pMin + i > pMax) {
              point[paper.paper_label] = null; // Set to null instead of returning
              return;
          }

          // Calculate value for relative year i
          // If cumulative, sum up to pMin + i
          // If not, just take value at pMin + i
          
          if (cumulative) {
             let count = 0;
             paper.citations.forEach(c => {
                 if (c.year <= pMin + i) count += c.cited_by_count;
             });
             point[paper.paper_label] = count;
          } else {
             const c = paper.citations.find(x => x.year === pMin + i);
             point[paper.paper_label] = c ? c.cited_by_count : 0;
          }
        });
        result.push(point);
      }
      return result;

    } else {
      // Calendar years
      return yearRange.map(year => {
        const point: any = { name: year.toString() };
        data.forEach(paper => {
           if (cumulative) {
             let count = 0;
             paper.citations.forEach(c => {
                 if (c.year <= year) count += c.cited_by_count;
             });
             point[paper.paper_label] = count;
           } else {
             const c = paper.citations.find(x => x.year === year);
             point[paper.paper_label] = c ? c.cited_by_count : 0;
           }
        });
        return point;
      });
    }
  }, [data, alignTimeline, cumulative]);

  return (
    <div className="relative group">
      <div
        ref={chartRef}
        className={
          (frame === false
            ? 'w-full bg-white'
            : 'w-full border border-gray-200 rounded-lg p-4 bg-white')
        }
        style={{ height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis scale={logScale ? 'log' : 'auto'} domain={logScale ? ['auto', 'auto'] : [0, 'auto']} allowDataOverflow={logScale} />
            <Tooltip />
            <Legend verticalAlign={legendPosition === 'top' || legendPosition === 'bottom' ? legendPosition : 'middle'} 
                    align={legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center'}
                    layout={legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal'}
            />
            {data.map((paper, index) => (
              <Line
                key={paper.paper_label}
                type="monotone"
                dataKey={paper.paper_label}
                stroke={COLORS[index % COLORS.length]}
                activeDot={{ r: 8 }}
                isAnimationActive={animation}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {frame !== false && (
        <button
          onClick={downloadImage}
          className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white border border-gray-200 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-600 hover:text-blue-600"
          title="Save as Image"
        >
          <Download size={18} />
        </button>
      )}
    </div>
  );
}
