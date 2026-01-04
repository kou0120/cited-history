"use client";

import React, { useState } from 'react';
import { CitationChart } from '@/components/CitationChart';
import { PaperData } from '@/lib/openalex';
import { Loader2, Link as LinkIcon } from 'lucide-react';

const DEFAULT_JSON = `[
  {
    "paper_label": "MAP2B",
    "doi": "10.1186/s13059-021-02576-9"
  },
  {
    "paper_label": "sylph",
    "doi": "10.1038/s41587-024-02412-y"
  },
  {
    "paper_label": "metaphlan4",
    "doi": "10.1038/s41587-023-01688-w"
  },
  {
    "paper_label": "motu2",
    "doi": "10.1038/s41467-019-08844-4"
  }
]`;

export default function Home() {
  const [jsonInput, setJsonInput] = useState(DEFAULT_JSON);
  const [data, setData] = useState<PaperData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Chart Options
  const [logScale, setLogScale] = useState(false);
  const [alignTimeline, setAlignTimeline] = useState(false);
  const [cumulative, setCumulative] = useState(true);
  const [legendPosition, setLegendPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      let parsedInput;
      try {
        parsedInput = JSON.parse(jsonInput);
      } catch (e) {
        throw new Error("Invalid JSON format");
      }

      const res = await fetch('/api/citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedInput),
      });
      
      if (!res.ok) {
        throw new Error("Failed to fetch data");
      }

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }
      
      setData(result);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getOgImageUrl = () => {
    if (typeof window === 'undefined') return '';
    try {
      const params = new URLSearchParams();
      params.set('data', btoa(jsonInput));
      params.set('log', logScale.toString());
      params.set('align', alignTimeline.toString());
      params.set('cum', cumulative.toString());
      params.set('legend', legendPosition);
      
      return `${window.location.origin}/api/render?${params.toString()}`;
    } catch (e) {
      return '';
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Citation History</h1>
          <p className="text-gray-500">Visualize citation trends for papers via OpenAlex</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Section */}
          <div className="space-y-6 lg:col-span-1">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
              <h2 className="font-semibold text-lg text-gray-900">Input Data</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  JSON Configuration
                </label>
                <textarea
                  className="w-full h-64 font-mono text-sm p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Enter JSON array of papers..."
                />
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Generate Chart
              </button>
              {error && (
                <div className="text-red-500 text-sm mt-2 p-2 bg-red-50 rounded">
                  {error}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
              <h2 className="font-semibold text-lg text-gray-900">Chart Options</h2>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    id="cumulative"
                    type="checkbox"
                    checked={cumulative}
                    onChange={(e) => setCumulative(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="cumulative" className="ml-2 block text-sm text-gray-900">
                    Cumulative Counts
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    id="logScale"
                    type="checkbox"
                    checked={logScale}
                    onChange={(e) => setLogScale(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="logScale" className="ml-2 block text-sm text-gray-900">
                    Log Scale
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    id="alignTimeline"
                    type="checkbox"
                    checked={alignTimeline}
                    onChange={(e) => setAlignTimeline(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="alignTimeline" className="ml-2 block text-sm text-gray-900">
                    Align Timeline (Relative Years)
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Legend Position
                  </label>
                  <select
                    value={legendPosition}
                    onChange={(e) => setLegendPosition(e.target.value as any)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-gray-900"
                  >
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[500px]">
              {data.length > 0 ? (
                <CitationChart 
                  data={data}
                  logScale={logScale}
                  alignTimeline={alignTimeline}
                  cumulative={cumulative}
                  legendPosition={legendPosition}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <p>Enter data and click Generate to view the chart</p>
                </div>
              )}
            </div>

             {data.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-semibold text-lg mb-2 text-gray-900">Image URL</h3>
                <div className="flex gap-2">
                  <input 
                    readOnly
                    value={getOgImageUrl()}
                    className="flex-1 p-2 text-sm border border-gray-300 rounded bg-gray-50 text-gray-900"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <a 
                    href={getOgImageUrl()} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium"
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Open
                  </a>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Use this URL to embed the chart image in other applications.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
