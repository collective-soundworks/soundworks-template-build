import path from 'node:path';

import chalk from 'chalk';
import rimraf from 'rimraf';

export function deleteBuild() {
  rimraf('.build', () => console.log(chalk.yellow(`+ deleted build folder`)));
}

export function clearCache() {
  const cache = path.join('node_modules', '.cache')
  rimraf(cache, () => console.log(chalk.yellow(`+ cleared node_modules/.cache`)));
}
