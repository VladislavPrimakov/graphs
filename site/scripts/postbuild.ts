import fs from 'node:fs';
import path from 'node:path';

const clientDir = path.resolve(import.meta.dirname, '../dist/client');
const graphsDir = path.join(clientDir, 'graphs');

if (fs.existsSync(graphsDir)) {
  fs.cpSync(graphsDir, clientDir, { recursive: true });
}

const notFoundSource = path.join(clientDir, '404', 'index.html');
const notFoundTarget = path.join(clientDir, '404.html');
if (fs.existsSync(notFoundSource)) {
  fs.copyFileSync(notFoundSource, notFoundTarget);
}
