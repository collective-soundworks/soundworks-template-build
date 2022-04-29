#!/usr/bin/env node

import { program } from 'commander';
import buildApplication from '../src/build-application.js';
import watchProcess from '../src/watch-process.js';
import clean from '../src/clean.js';

program
  .option('-b, --build', 'build application')
  .option('-w, --watch', 'watch file system to rebuild application (use in conjunction with --build)')
  .option('-m, --minify', 'minify browser js files on build  (use in conjunction with --build)')
  .option('-p, --watch-process <name>', 'restart a node process on each build')
  .option('-i, --inspect', 'enable inspect when watching a process')
  .option('-c, --clean', 'clean project')
;

program.parse(process.argv);
const options = program.opts();

if (options.build) {
  buildApplication(options.watch, options.minify);
}

if (options.watchProcess) {
  watchProcess(options.watchProcess, options.inspect);
}

if (options.watchProcessInspect) {
  watchProcess(options.watchProcessInspect, true);
}

if (options.clean) {
  clean();
}


