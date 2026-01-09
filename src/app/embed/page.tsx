"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CitationChart } from '@/components/CitationChart';
import { PaperData } from '@/lib/openalex';
import { Loader2 } from 'lucide-react';

function EmbedContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaperData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const encodedData = searchParams.get('data');
  const logScale = searchParams.get('log') === 'true';
  const alignTimeline = searchParams.get('align') === 'true';
  const cumulative = searchParams.get('cum') === 'true';
  // Default to top legend for embed unless specified
  const legendPosition = (searchParams.get('legend') as any) || 'top'; 
  const renderMode = searchParams.get('render') === 'true';

  useEffect(() => {
    (window as any).__CHART_READY__ = false;
  }, []);

  useEffect(() => {
    if (loading || error || data.length === 0) {
      (window as any).__CHART_READY__ = false;
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        (window as any).__CHART_READY__ = true;
      });
    });
  }, [loading, error, data]);

  useEffect(() => {
    if (!encodedData) {
      setError("No data provided");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        let papers: { paper_label: string; doi: string }[] = [];
        try {
          const jsonStr = atob(encodedData);
          papers = JSON.parse(jsonStr);
        } catch (e) {
          throw new Error("Invalid Data encoding");
        }

        const res = await fetch('/api/citations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(papers),
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

    loadData();
  }, [encodedData]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-white p-4">
      <div
        className="bg-white w-full"
        style={renderMode 
          ? { width: '800px', height: '630px' } 
          : { maxWidth: '800px' }
        }
      >
        <CitationChart 
            data={data}
            logScale={logScale}
            alignTimeline={alignTimeline}
            cumulative={cumulative}
            legendPosition={legendPosition}
            height={renderMode ? 630 : 500}
            frame={!renderMode}
            animation={!renderMode}
        />
      </div>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>}>
      <EmbedContent />
    </Suspense>
  );
}
