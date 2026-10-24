import fs from 'node:fs';
import path from 'node:path';

const clientDir = path.resolve(import.meta.dirname, '../dist/client');

const notFoundSource = path.join(clientDir, '404', 'index.html');
const notFoundTarget = path.join(clientDir, '404.html');
if (fs.existsSync(notFoundSource)) {
  fs.copyFileSync(notFoundSource, notFoundTarget);
}
