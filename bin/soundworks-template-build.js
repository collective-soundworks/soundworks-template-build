#!/usr/bin/env node

const program = require('commander');
const buildApplication = require('../src/build-application');
const watchProcess = require('../src/watch-process');
// const minify = require('../src/minify');
const clean = require('../src/clean');
const checkTypes = require('../src/check-types');

program
  .option('-b, --build', 'build application')
  .option('-w, --watch', 'watch file system to rebuild application (use in conjunction with --build)')
  .option('-m, --minify', 'minify browser js files on build  (use in conjunction with --build)')
  .option('-p, --watch-process <name>', 'restart a node process on each build')
  .option('-i, --inspect', 'enable inspect when watching a process')
  .option('-c, --clean', 'clean project')
  .option('-t, --check-types', 'check the types using TypeScript (use by passing the tsconfig file)')
;

program.parse(process.argv);
//console.log(process.argv);

if (program.build) {
  buildApplication(program.watch, program.minify);
}

if (program.watchProcess) {
  watchProcess(program.watchProcess, program.inspect);
}

if (program.watchProcessInspect) {
  watchProcess(program.watchProcessInspect, true);
}

if (program.clean) {
  clean();
}

if (program.checkTypes) {
  checkTypes(process.argv);
}