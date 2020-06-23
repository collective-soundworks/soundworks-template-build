#!/usr/bin/env node
const babel = require('@babel/core');
const chalk = require('chalk')
const chokidar = require('chokidar');
const fs = require('fs-extra');
const path = require('path');
const rollup = require('rollup');

const commonjs = require('rollup-plugin-commonjs');
const rollupBabel = require('rollup-plugin-babel');
const resolve = require('rollup-plugin-node-resolve');
const json = require('rollup-plugin-json');
const nodeBuiltins = require('rollup-plugin-node-builtins');
const globals = require('rollup-plugin-node-globals');
const sourcemaps = require('rollup-plugin-sourcemaps');
const JSON5 = require('json5');

const cwd = process.cwd();

// we need support for iOS 9.3.5
const browserList = 'ios >= 9, not ie 11, not op_mini all';

function createNodeWatcher(inputFolder, outputFolder, watch) {
  // if watch is true, we want to ignore the initial watcher scan and resolve early
  // if watch is false, we want to wait for the whole directory to be build before resolving
  const initialScanPromises = [];

  function compileOrCopy(pathname) {
    if (fs.lstatSync(pathname).isDirectory()) {
      return;
    }

    const inputFilename = pathname;
    const outputFilename = inputFilename.replace(inputFolder, outputFolder);
    fs.ensureFileSync(outputFilename);

    if (/(\.js|\.mjs)$/.test(inputFilename)) {
      const promise = new Promise((resolve, reject) => {
        babel.transformFile(inputFilename, {
          inputSourceMap: true,
          sourceMap: "inline",
          plugins: [
            ['@babel/plugin-transform-modules-commonjs'],
            ['@babel/plugin-transform-arrow-functions'],
            ['@babel/plugin-proposal-class-properties', { loose : true }]
          ]
        }, function (err, result) {
          if (err) {
            return console.log(err.message);
            reject();
          }

          resolve();
          fs.writeFileSync(outputFilename, result.code);
          console.log(chalk.green(`> transpiled\t ${inputFilename}`));
        });
      });

      if (!watch) {
        initialScanPromises.push(promise);
      }
    } else {
      fs.copyFileSync(inputFilename, outputFilename);
      console.log(chalk.green(`> copied\t ${inputFilename}`));

      if (!watch) {
        initialScanPromises.push(Promise.resolve());
      }
    }
  }

  const chokidarOptions = watch ? { ignoreInitial: true } : {};
  const watcher = chokidar.watch(inputFolder, chokidarOptions);

  watcher.on('add', pathname => compileOrCopy(pathname));
  watcher.on('change', pathname => compileOrCopy(pathname));
  watcher.on('unlink', pathname => {
    const outputFilename = pathname.replace(inputFolder, outputFolder);
    fs.unlinkSync(outputFilename);
  });

  if (watch) {
    return Promise.resolve();
  } else {
    return new Promise(resolve => {
      // initial scan is done, we kill the watcher
      // and wait the files to be transpiled
      watcher.on('ready', () => {
        watcher.close();
        Promise.all(initialScanPromises).then(resolve);
      });
    });
  }
}

function createBrowserWatcher(inputFile, outputFile, watch) {
  // if watch is true, we want to ignore the initial watcher scan and resolve early
  // if watch is false, we want to wait for the whole directory to be build before resolving

  // this does seem to work properly...
  const chokidarOptions = watch ? { ignoreInitial: true } : {};

  const watcher = rollup.watch({
    input: inputFile,
    plugins: [
      commonjs(),
      rollupBabel({
        sourceMaps: true,
        inputSourceMap: true,
        sourceMap: "inline",
        presets: [
          ["@babel/preset-env",
            {
              targets: browserList,
            }
          ]
        ],
        plugins: [
          // ['@babel/plugin-transform-modules-commonjs'],
          ['@babel/plugin-transform-arrow-functions'],
          ['@babel/plugin-proposal-class-properties', { loose : true }]
        ]
      }),
      resolve({
        mainFields: ['browser', 'module', 'main'],
        preferBuiltins: false,
      }),
      json(),
      nodeBuiltins(),
      globals({
        buffer: false,
        dirname: false,
        filename: false,
      }),
      sourcemaps(),
    ],
    output: [
      {
        file: outputFile,
        format: 'iife',
        sourcemap: 'inline',
        onwarn(warning, warn) {
          // skip certain warnings
          if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
          // throw on others
          if (warning.code === 'NON_EXISTENT_EXPORT') throw new Error(warning.message);
          // Use default for everything else
          warn(warning);
        }
      },
    ],
    watch: {
      chokidar: chokidarOptions,
      clearScreen: false,
    }
  });

  watcher.on('event', (e) => {
    if (e.code === 'BUNDLE_END') {
      console.log(chalk.green(`> bundled\t ${outputFile.replace(cwd, '')}`));
      resolve();
    } else if (e.code === 'ERROR' || e.code === 'FATAL') {
      console.log(chalk.red(e.error.message));
      console.log(e.error.frame);
    }
  });

  return new Promise((resolve, reject) => {
    watcher.on('event', (e) => {
      if (e.code === 'BUNDLE_END' || e.code === 'ERROR' || e.code === 'FATAL') {
        // we wait for the bundle even in watch mode because rollup.watch cannot
        // ignore initial and we want to avoid parallel builds
        resolve();
        if (!watch) {
          watcher.close();
        }
      }
    });
  });
}


module.exports = async function buildApplication(watch = false) {
  const cmdString = watch ? 'watching' : 'building';
  // -----------------------------------------
  // server files
  // -----------------------------------------
  {
    console.log(chalk.yellow(`+ ${cmdString} server`));
    const configSrc = path.join('src', 'server');
    const configDist = path.join('.build', 'server');
    await createNodeWatcher(configSrc, configDist, watch);
  }

  // -----------------------------------------
  // clients files
  // -----------------------------------------
  {
    // utility function
    function getClientTarget(name) {
      try {
        const data = fs.readFileSync(path.join(cwd, 'config', 'application.json'));
        const config = JSON5.parse(data);
        const clientsConfig = config.clients

        if (clientsConfig[name] && clientsConfig[name].target) {
          return clientsConfig[name].target;
        } else {
          return null;
        };
      } catch(err) {
        console.log(chalk.red('> Invalid `config/application.json` file'));
        process.exit(0);
      }
    }

    // real process
    const clientsSrc = path.join('src', 'clients');
    const filenames = fs.readdirSync(clientsSrc);
    const clients = filenames.filter(filename => {
      const relPath = path.join(clientsSrc, filename);
      const isDir = fs.lstatSync(relPath).isDirectory();
      return isDir;
    }).sort((a, b) => {
      // we want to build the browsers files last
      const aTarget = getClientTarget(a);
      return (aTarget === 'browser') ? 1 : -1;
    });

    for (let clientName of clients) {
      const target = getClientTarget(clientName);
      // IoT clients or any shared/utils file
      if (target !== 'browser') {
        if (target === 'node') {
          console.log(chalk.yellow(`+ ${cmdString} node client "${clientName}"`));
        } else {
          console.log(chalk.yellow(`+ ${cmdString} folder "${clientName}"`));
        }

        const inputFolder = path.join('src', 'clients', clientName);
        const outputFolder = path.join('.build', clientName);
        await createNodeWatcher(inputFolder, outputFolder, watch);
      // regular browser clients
      } else {
        console.log(chalk.yellow(`+ ${cmdString} browser client "${clientName}"`));
        const inputFile = path.join(cwd, 'src', 'clients', clientName, 'index.js');
        const outputFile = path.join(cwd, '.build', 'public', `${clientName}.js`);
        await createBrowserWatcher(inputFile, outputFile, watch);
      }
    }
  }

  process.on('SIGINT', function() {
    console.log(chalk.cyan('\n>>> EXIT'))
    process.exit();
  });
}


