export interface CitationData {
  year: number;
  cited_by_count: number;
}

export interface PaperData {
  paper_label: string;
  doi: string;
  citations: CitationData[];
  total_citations: number;
  title?: string;
}

export async function fetchCitationHistory(doi: string): Promise<CitationData[]> {
  // Normalize DOI
  const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '');
  const url = `https://api.openalex.org/works/https://doi.org/${cleanDoi}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mailto:citation-history-app@localhost'
      }
    });
    if (!response.ok) {
      console.error(`Failed to fetch data for DOI: ${doi}`, response.statusText);
      return [];
    }
    const data = await response.json();
    return data.counts_by_year || [];
  } catch (error) {
    console.error(`Error fetching data for DOI: ${doi}`, error);
    return [];
  }
}
