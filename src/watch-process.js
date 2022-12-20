import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';

import chalk from 'chalk';
import chokidar from 'chokidar';
import debounce from 'lodash.debounce';
import JSON5 from 'json5';
import terminate from 'terminate';

const processes = new Map();

// run the in a forked process
const start = async function(src, inspect) {
  if (!fs.existsSync(src)) {
    console.log(chalk.red(`
Cannot start process: file "${src}" does not exists.
- try to run \`npm run build\` again
`));
    return;
  }

  fs.stat(src, async (err, stats) => {
    if (err) {
      console.log(err);
      return;
    }

    if (processes.has(src)) {
      await stop(src);
    }

    const options = inspect
      ? { execArgv: ['--inspect', '--trace-deprecation'] }
      : {};

    Object.assign(options, { stdio: 'inherit' });

    const delay = inspect ? 100 : 0;

    // @important - the timeout is needed for the inspect to properly exit
    // the value has been chosen by "rule of thumb"
    setTimeout(() => {
      // console.log(options);
      const proc = fork(src, [], options);
      processes.set(src, proc);
    }, delay);
  });
}

// kill the forked process hosting the proc
const stop = async function(src) {
  return new Promise((resolve, reject) => {
    const proc = processes.get(src);

    if (proc) {
      terminate(proc.pid, 'SIGINT', (err) => {
        if (err) {
          reject(err);
        }
      });
    }

    processes.delete(src);
    resolve();
  });
}

export default function watchProcess(processName, inspect) {
  let processPath = null;

  if (processName === 'server') {
    processPath = path.join('.build', processName);
  } else {
    // check folder exists
    // check client is declared as a "node" type in `config/application.json`
    if (!fs.existsSync(path.join('.build', 'clients', processName))) {
      console.log(chalk.red(`[@soundworks/devtools]
> Can't watch process \`${processName}\`, path \`.build/clients/${processName}\` does not exists`));
      process.exit(0);
    }

    let clientsConfig = null;

    // move that to external file and watch it
    try {
      const configData = fs.readFileSync(path.join('config', 'application.json'));
      const config = JSON5.parse(configData);
      clientsConfig = config.clients
    } catch(err) {
      console.log(chalk.red(`[@soundworks/devtools]
> Invalid \`config/application.json\` file`));
      console.log(err);
      process.exit(0);
    }
    // check client is declared as a "node" type in `config/application.json`
    if (!clientsConfig[processName] || clientsConfig[processName].target !== 'node') {
      console.log(chalk.red(`[@soundworks/devtools]
> Process \`${processName}\` not declared as \`{ "target": "node" }\` in \`config/application.json\``));
      process.exit(0);
    }

    processPath = path.join('.build', 'clients', processName);
  }

  const watcher = chokidar.watch([processPath, path.join('config')], {
    ignoreInitial: true,
  });

  console.log(chalk.cyan(`> watching process\t ${processPath}`));

  watcher.on('change', debounce(filename => start(processPath, inspect), 500))
  // as we ignore initial changes we can start the process now
  start(processPath, inspect);
}











