#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const terminate = require('terminate');
const { fork } = require('child_process');
const chalk = require('chalk')

// Process hosting the proc
let proc = null;
const processes = new Map();

// run the in a forked process
const start = function(src) {
  fs.stat(src, (err, stats) => {
    if (err) {
      reject(src);
    }

    if (processes.has(src)) {
      stop(src);
    }

    proc = fork(src);
    processes.set(src, proc);
  });
}

// kill the forked process hosting the proc
const stop = function(src) {
  const proc = processes.get(src);
  let stopped = false;

  if (proc) {
    terminate(proc.pid);
    stopped = true;
  }

  processes.delete(src);
}

module.exports = function watchProcess(processName) {
  const processPath = path.join('dist', processName);

  if (!fs.existsSync(processPath)) {
    throw new Error(`Cannot start process "${processName}": file "${processPath}" does not exists`);
  }

  let ignoreInitial = false;

  if (processName === 'server') {
    ignoreInitial = true;
  }

  const watcher = chokidar.watch(processPath, {
    persistent: true,
    ignoreInitial,
  });

  console.log(chalk.cyan(`> watching process\t ${processPath}`));
  // restart to principal target (processPath)
  watcher
    .on('add', filename => start(processPath))
    .on('change', filename => {
      start(processPath);
    })
    .on('unlink', filename => stop(processPath));
}











