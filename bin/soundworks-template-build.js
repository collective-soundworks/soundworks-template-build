#!/usr/bin/env node

const program = require('commander');
const buildApplication = require('./build-application');
const watchProcess = require('./watch-process');
const minify = require('./minify');

program
  .option('-b, --build', 'build application')
  .option('-w, --watch', 'watch file system to rebuild application')
  .option('-p, --watch-process <name>', 'restart a node process on each build')
  .option('-m, --minify', 'minify public js files')
;

program.parse(process.argv);

if (program.build) {
  buildApplication(program.watch);
}

if (program.watchProcess) {
  watchProcess(program.watchProcess);
}

if (program.minify) {
  minify();
}


