import { chromium } from 'playwright';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');
  const proto = forwardedProto || url.protocol.replace(':', '');
  const origin = host ? `${proto}://${host}` : url.origin;

  const params = new URLSearchParams(url.searchParams);
  params.set('render', 'true');

  const targetUrl = `${origin}/embed?${params.toString()}`;

  let browser: any;
  try {
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage({
      viewport: { width: 800, height: 630 },
      deviceScaleFactor: 1,
    });

    page.setDefaultTimeout(30_000);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => (window as any).__CHART_READY__ === true);

    const png = await page.screenshot({ type: 'png' });

    return new Response(png, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=3600',
      },
    });
  } catch (e: any) {
    return new Response(`render error: ${e?.message || String(e)}`, {
      status: 500,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
  }
}
