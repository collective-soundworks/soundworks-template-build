#!/usr/bin/env node

const program = require('commander');
const buildApplication = require('../src/build-application');
const watchProcess = require('../src/watch-process');
const minify = require('../src/minify');
const clean = require('../src/clean');

program
  .option('-b, --build', 'build application')
  .option('-w, --watch', 'watch file system to rebuild application')
  .option('-p, --watch-process <name>', 'restart a node process on each build')
  .option('-pi, --watch-process-inspect <name>', 'restart a node process on each build')
  .option('-m, --minify', 'minify browser js files')
  .option('-c, --clean', 'clean project')
;

program.parse(process.argv);

if (program.build) {
  buildApplication(program.watch);
}

if (program.watchProcess) {
  watchProcess(program.watchProcess);
}

if (program.watchProcessInspect) {
  watchProcess(program.watchProcessInspect, true);
}

if (program.minify) {
  minify();
}

if (program.clean) {
  clean();
}


