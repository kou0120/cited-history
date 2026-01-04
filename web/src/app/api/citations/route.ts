import { NextResponse } from 'next/server';
import { fetchCitationHistory, PaperData } from '@/lib/openalex';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Handle the case where the user might provide the broken JSON from the readme example
    // which looked like an object of objects or invalid array syntax.
    // We will assume it's an array of objects.
    let papers: { paper_label: string; doi: string }[] = [];
    
    if (Array.isArray(body)) {
      papers = body;
    } else {
        return NextResponse.json({ error: 'Invalid input format. Expected an array of objects.' }, { status: 400 });
    }

    const results: PaperData[] = await Promise.all(
      papers.map(async (paper) => {
        const citations = await fetchCitationHistory(paper.doi);
        const total = citations.reduce((acc, curr) => acc + curr.cited_by_count, 0);
        return {
          paper_label: paper.paper_label,
          doi: paper.doi,
          citations,
          total_citations: total,
        };
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
