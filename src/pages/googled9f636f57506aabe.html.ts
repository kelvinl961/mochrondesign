export const prerender = true;

export function GET() {
  return new Response('google-site-verification: googled9f636f57506aabe.html\n', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
