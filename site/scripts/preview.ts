import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(import.meta.dirname, '../dist/client');
const defaultPort = Number(process.env.PORT ?? 3001);
const rawBase = process.env.BASE_URL ?? '/graphs';
const base = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;

function startServer(port: number, maxAttempts = 10) {
  try {
    const server = Bun.serve({
      port,
      fetch(req) {
        const url = new URL(req.url);
        let pathname = decodeURIComponent(url.pathname);

        // Normalize base URL prefix
        if (base !== '/' && pathname.startsWith(base)) {
          pathname = pathname.slice(base.length) || '/';
        }

        const fullPath = path.join(distDir, pathname);

        // 1. Check if path exists directly or as directory
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const indexPath = path.join(fullPath, 'index.html');
            if (fs.existsSync(indexPath)) {
              return new Response(Bun.file(indexPath));
            }
          } else {
            return new Response(Bun.file(fullPath));
          }
        }

        // 2. Check if path + '.html' exists
        const htmlPath = `${fullPath}.html`;
        if (fs.existsSync(htmlPath)) {
          return new Response(Bun.file(htmlPath));
        }

        // 3. Fallback to 404.html
        const notFoundPath = path.join(distDir, '404.html');
        if (fs.existsSync(notFoundPath)) {
          return new Response(Bun.file(notFoundPath), {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }

        return new Response('404 Not Found', { status: 404 });
      },
    });

    console.log(`\n  ➜  Preview: http://localhost:${server.port}${base === '/' ? '/' : `${base}/`}\n`);
    return server;
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'EADDRINUSE' && maxAttempts > 0) {
      console.log(`  Port ${port} is in use, trying port ${port + 1}...`);
      return startServer(port + 1, maxAttempts - 1);
    }
    throw err;
  }
}

startServer(defaultPort);
