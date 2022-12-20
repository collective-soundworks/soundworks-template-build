import { fork } from 'node:child_process';
import path from 'node:path';
import * as url from 'node:url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

fork(path.join(__dirname, 'cli.js'), [], {
  stdio: 'inherit',
});

setTimeout(() => {
  console.log('coucou');
}, 100);
