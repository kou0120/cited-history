import { ImageResponse } from 'next/og';
import { fetchCitationHistory, PaperData } from '@/lib/openalex';

export const runtime = 'edge';

// Helper to generate a Monotone Cubic Spline SVG path
// Matches Recharts 'monotone' interpolation
function getSmoothSvgPath(points: { x: number; y: number }[], scaleX: (v: number) => number, scaleY: (v: number) => number): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${scaleX(points[0].x)} ${scaleY(points[0].y)}`;

    const data = points.map(p => ({ x: scaleX(p.x), y: scaleY(p.y) }));
    
    // Monotone Cubic Spline implementation
    const n = data.length;
    const d: number[] = [];
    const m: number[] = [];
    const dx: number[] = [];
    const dy: number[] = [];

    // 1. Calculate secants and tangents
    for (let i = 0; i < n - 1; i++) {
        dx[i] = data[i + 1].x - data[i].x;
        dy[i] = data[i + 1].y - data[i].y;
        d[i] = dy[i] / dx[i];
    }

    m[0] = d[0];
    m[n - 1] = d[n - 2];

    for (let i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] <= 0) {
            m[i] = 0;
        } else {
            m[i] = (d[i - 1] + d[i]) / 2; // Simple average for tangent
        }
    }

    // 2. Adjust tangents to ensure monotonicity (Fritsch-Carlson)
    for (let i = 0; i < n - 1; i++) {
        if (d[i] === 0) {
            m[i] = 0;
            m[i + 1] = 0;
        } else {
            const alpha = m[i] / d[i];
            const beta = m[i + 1] / d[i];
            if (alpha * alpha + beta * beta > 9) {
                const tau = 3 / Math.sqrt(alpha * alpha + beta * beta);
                m[i] = tau * alpha * d[i];
                m[i + 1] = tau * beta * d[i];
            }
        }
    }

    // 3. Generate Bezier Control Points
    let path = `M ${data[0].x} ${data[0].y}`;
    for (let i = 0; i < n - 1; i++) {
        const p0 = data[i];
        const p1 = data[i + 1];
        const len = dx[i];
        
        // Control points
        // cp1 = p0 + (1/3) * tangent_at_p0
        // cp2 = p1 - (1/3) * tangent_at_p1
        // We need to scale tangents by length/3?
        // Actually, m[i] is the slope (dy/dx). 
        // Tangent vector at p0 is (1, m[i]). Normalized? No, we need it relative to dx.
        // Control point x-coord is usually 1/3 of the interval.
        
        const cp1x = p0.x + len / 3;
        const cp1y = p0.y + (m[i] * len) / 3;
        
        const cp2x = p1.x - len / 3;
        const cp2y = p1.y - (m[i + 1] * len) / 3;

        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }

    return path;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const encodedData = searchParams.get('data');
    const logScale = searchParams.get('log') === 'true';
    const alignTimeline = searchParams.get('align') === 'true';
    const cumulative = searchParams.get('cum') === 'true';
    const legendPosition = searchParams.get('legend') || 'top';

    if (!encodedData) {
      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              fontSize: 40,
              color: 'black',
              background: 'white',
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            No data provided
          </div>
        ),
        { width: 800, height: 630 }
      );
    }

    let papers: { paper_label: string; doi: string }[] = [];
    try {
      const jsonStr = atob(encodedData);
      papers = JSON.parse(jsonStr);
    } catch (e) {
      return new ImageResponse(<div>Invalid Data</div>, { width: 800, height: 630 });
    }

    // Fetch data
    const data: PaperData[] = await Promise.all(
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

    // --------------------------------------------------------
    // Prepare Data for Charting
    // --------------------------------------------------------
    
    // Gather all relevant years/x-values to determine bounds
    let pointsPerPaper: { label: string; points: { x: number; y: number }[]; color: string }[] = [];
    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    let minX = Infinity, maxX = -Infinity;
    let minY = 0, maxY = 0; // Y starts at 0 usually

    if (alignTimeline) {
      // Relative Years Mode
      let globalMaxDuration = 0;
      data.forEach(paper => {
        if (paper.citations.length > 0) {
            const pMin = Math.min(...paper.citations.map(c => c.year));
            const pMax = Math.max(...paper.citations.map(c => c.year));
            globalMaxDuration = Math.max(globalMaxDuration, pMax - pMin);
        }
      });
      minX = 0;
      maxX = globalMaxDuration;

      data.forEach((paper, idx) => {
        const paperPoints: { x: number; y: number }[] = [];
        if (paper.citations.length > 0) {
            const pMin = Math.min(...paper.citations.map(c => c.year));
            const pMax = Math.max(...paper.citations.map(c => c.year));
            
            // Only iterate up to THIS paper's duration to cut off the line
            const duration = pMax - pMin;

            for (let i = 0; i <= duration; i++) {
                let val = 0;
                if (cumulative) {
                    let count = 0;
                    paper.citations.forEach(c => {
                        if (c.year <= pMin + i) count += c.cited_by_count;
                    });
                    val = count;
                } else {
                    const c = paper.citations.find(x => x.year === pMin + i);
                    val = c ? c.cited_by_count : 0;
                }
                // Handle log scale
                if (logScale) {
                    // For log scale visualization, we can just plot log10(val). 
                    // To handle 0, we can clamp to 0 or start at a small epsilon.
                    // Usually log plots don't show 0. Let's say if val <= 0 -> 0 for plotting height.
                    val = Math.log10(val + 1);
                }
                paperPoints.push({ x: i, y: val });
                maxY = Math.max(maxY, val);
            }
        }
        pointsPerPaper.push({ label: paper.paper_label, points: paperPoints, color: COLORS[idx % COLORS.length] });
      });

    } else {
       // Calendar Years Mode
       let allYears: number[] = [];
       data.forEach(p => p.citations.forEach(c => allYears.push(c.year)));
       
       if (allYears.length > 0) {
           minX = Math.min(...allYears);
           maxX = Math.max(...allYears);
       } else {
           minX = new Date().getFullYear();
           maxX = new Date().getFullYear();
       }

       const yearRange = Array.from({ length: maxX - minX + 1 }, (_, i) => minX + i);

       data.forEach((paper, idx) => {
         const paperPoints: { x: number; y: number }[] = [];
         
         // For calendar years, we check if we should cut off? 
         // User only mentioned align timeline cutoff.
         // Usually calendar years are plotted continuously if it's a history.
         // Let's assume continuous for calendar years for now, or match available data range?
         // Recharts version fills all years in range. We'll match that.
         
         yearRange.forEach(year => {
             let val = 0;
             if (cumulative) {
                let count = 0;
                paper.citations.forEach(c => {
                    if (c.year <= year) count += c.cited_by_count;
                });
                val = count;
             } else {
                const c = paper.citations.find(x => x.year === year);
                val = c ? c.cited_by_count : 0;
             }
             if (logScale) val = Math.log10(val + 1);
             paperPoints.push({ x: year, y: val });
             maxY = Math.max(maxY, val);
         });
         pointsPerPaper.push({ label: paper.paper_label, points: paperPoints, color: COLORS[idx % COLORS.length] });
       });
    }

    // padding/buffer for max Y
    if (maxY === 0) maxY = 10;
    else if (!logScale) maxY = maxY * 1.1; // Add 10% headroom

    // --------------------------------------------------------
    // Chart Layout & Rendering
    // --------------------------------------------------------
    const width = 800;
    const height = 630;
    // Increased bottom/left padding for labels and titles
    const padding = { top: 80, right: 60, bottom: 160, left: 170 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const xAxisLineY = height - padding.bottom;
    const xTickTop = xAxisLineY + 12;
    const xTitleTop = xAxisLineY + 60;

    const scaleX = (x: number) => {
        if (maxX === minX) return padding.left + chartWidth / 2;
        return ((x - minX) / (maxX - minX)) * chartWidth + padding.left;
    };
    const scaleY = (y: number) => padding.top + chartHeight - (y / maxY) * chartHeight;

    // --- Grid Lines & Axes ---
    const xTicks = 6;
    const yTicks = 5;

    // X Axis Ticks
    const xGridLines = [];
    const xTickLabels = [];
    for (let i = 0; i <= xTicks; i++) {
        const val = minX + (maxX - minX) * (i / xTicks);
        const xPos = scaleX(val);
        
        xGridLines.push(
            <line key={`xgrid-${i}`} x1={xPos} y1={padding.top} x2={xPos} y2={xAxisLineY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
        );
        
        xTickLabels.push(
            <div 
                key={`xtick-${i}`} 
                style={{ 
                    position: 'absolute', 
                    left: xPos, 
                    top: xTickTop, 
                    transform: 'translateX(-50%)',
                    fontSize: 20, 
                    color: '#6b7280',
                    display: 'flex' 
                }}
            >
                {Math.round(val)}
            </div>
        );
    }

    // Y Axis Ticks
    const yGridLines = [];
    const yTickLabels = [];
    for (let i = 0; i <= yTicks; i++) {
        const val = (maxY * i) / yTicks;
        const yPos = scaleY(val);
        
        let label = val.toFixed(1);
        if (logScale && val > 0) {
             // Show original value for log scale ticks: 10^val
             // e.g. val=2 -> 100
             const originalVal = Math.pow(10, val) - 1;
             if (originalVal >= 1000) {
                // e.g. 1k, 10k
                label = (originalVal / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
             } else if (originalVal >= 1) {
                label = Math.round(originalVal).toString();
             } else {
                label = originalVal.toFixed(2);
             }
        } else if (logScale) {
             label = "0"; // or 1? log(1)=0. If val=0, that means count=1 (since log10(1)=0). 
             // If we clamped 0 to 0, then original is 0.
             // But if val=0 came from Math.log10(1), then original is 1.
             // Our logic was: val = val > 0 ? Math.log10(val) : 0;
             // If original was 0, val is 0. If original was 1, val is 0.
             // It's ambiguous at 0. Let's assume 0.
             label = "0";
        } else {
             label = Math.round(val).toString();
        }

        yGridLines.push(
            <line key={`ygrid-${i}`} x1={padding.left} y1={yPos} x2={width - padding.right} y2={yPos} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
        );

        yTickLabels.push(
            <div 
                key={`ytick-${i}`} 
                style={{ 
                    position: 'absolute', 
                    left: padding.left - 20, 
                    top: yPos - 14, 
                    width: 90, // Fixed width to align right
                    transform: 'translateX(-100%)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    fontSize: 20, 
                    color: '#6b7280'
                }}
            >
                {label}
            </div>
        );
    }

    // --- Data Lines & Dots ---
    const dots: any[] = [];
    const paths = pointsPerPaper.map(p => {
        if (p.points.length === 0) return null;
        const d = getSmoothSvgPath(p.points, scaleX, scaleY);

        // Generate dots for each point
        p.points.forEach((pt, i) => {
             dots.push(
                <circle 
                    key={`${p.label}-${i}`}
                    cx={scaleX(pt.x)}
                    cy={scaleY(pt.y)}
                    r="3"
                    fill="white"
                    stroke={p.color}
                    strokeWidth="2"
                />
             );
        });
        
        return (
            <path
                key={p.label}
                d={d}
                stroke={p.color}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        );
    });

    // --- Legend ---
    const legendStyle: any = {
        display: 'flex',
        gap: '24px',
        position: 'absolute',
    };
    if (legendPosition === 'bottom') {
        legendStyle.bottom = 20;
        legendStyle.left = padding.left;
        legendStyle.right = padding.right;
        legendStyle.justifyContent = 'center';
    } else if (legendPosition === 'left') {
        legendStyle.left = 20;
        legendStyle.top = padding.top;
        legendStyle.bottom = padding.bottom;
        legendStyle.flexDirection = 'column';
        legendStyle.justifyContent = 'center';
    } else if (legendPosition === 'right') {
        legendStyle.right = 20;
        legendStyle.top = padding.top;
        legendStyle.bottom = padding.bottom;
        legendStyle.flexDirection = 'column';
        legendStyle.justifyContent = 'center';
    } else {
        legendStyle.top = 20;
        legendStyle.left = padding.left;
        legendStyle.right = padding.right;
        legendStyle.justifyContent = 'center';
    }

    const legend = (
        <div style={legendStyle}>
            {pointsPerPaper.map(p => (
                <div key={p.label} style={{ display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 500, color: p.color }}>
                    <svg width={34} height={14} viewBox="0 0 34 14" style={{ marginRight: 8 }}>
                        <line x1={0} y1={7} x2={34} y2={7} stroke={p.color} strokeWidth={4} strokeLinecap="round" />
                        <circle cx={17} cy={7} r={4} fill="white" stroke={p.color} strokeWidth={2} />
                    </svg>
                    <span>{p.label}</span>
                </div>
            ))}
        </div>
    );

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: 'white',
            position: 'relative',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Main Chart Area (SVG for lines) */}
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
             <defs>
               <clipPath id="plotAreaClip">
                 <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} />
               </clipPath>
             </defs>
             {/* Grid */}
             {xGridLines}
             {yGridLines}
             
             {/* Axes Lines */}
             <line x1={padding.left} y1={xAxisLineY} x2={width - padding.right} y2={xAxisLineY} stroke="#9ca3af" strokeWidth="2" />
             <line x1={padding.left} y1={padding.top} x2={padding.left} y2={xAxisLineY} stroke="#9ca3af" strokeWidth="2" />

             {/* Data */}
             <g clipPath="url(#plotAreaClip)">
               {paths}
               {dots}
             </g>
          </svg>

          {/* HTML Overlay for Text */}
          {xTickLabels}
          {yTickLabels}

          {/* Legend */}
          {legend}
          
          {/* Axis Labels */}
          <div style={{ position: 'absolute', top: xTitleTop, left: 0, width: '100%', display: 'flex', justifyContent: 'center', fontSize: 24, color: '#374151', fontWeight: 'bold' }}>
            {alignTimeline ? 'Relative Years' : 'Year'}
          </div>
          <div style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%) rotate(-90deg)', fontSize: 24, color: '#374151', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
             <span>{logScale ? 'Log Citations' : 'Citations'}</span>
          </div>
        </div>
      ),
      {
        width: 800,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(e);
    return new ImageResponse(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 40, color: 'red' }}>
            Error generating chart: {e.message}
        </div>, 
        { width: 800, height: 630 }
    );
  }
}
