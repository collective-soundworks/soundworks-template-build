import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

import babel from '@babel/core';
import chalk from 'chalk';
import chokidar from 'chokidar';
import fs from 'fs-extra';
import JSON5 from 'json5';
import klawSync from 'klaw-sync';
import webpack from 'webpack';
// import sm from 'source-map';

const cwd = process.cwd();
// for clean resolve even if using `npm link`:
// https://github.com/facebook/create-react-app/blob/7408e36478ea7aa271c9e16f51444547a063b400/packages/babel-preset-react-app/index.js#L15
const require = createRequire(import.meta.url);

// @todo - if app config says typescript, use /\.(js|mjs|ts|tsx)$/
const supportedFilesRegExp = /\.(js|jsx|mjs|ts|tsx)$/;

// @todo - remove this...
// we need support for iOS 9.3.5
// const browserList = 'ios >= 9, not ie 11, not op_mini all';

/**
 * All babel plugins we use are contained in the preset-env, so no need to
 * have them in dependencies.
 */
async function transpile(inputFolder, outputFolder, watch) {
  async function compileOrCopy(pathname) {
    if (fs.lstatSync(pathname).isDirectory()) {
      return Promise.resolve();
    }

    const inputFilename = pathname;
    const outputFilename = inputFilename
      .replace(inputFolder, outputFolder)
      .replace(/\.ts[x]?$/, '.js');

    if (supportedFilesRegExp.test(inputFilename)) {
      try {
        const sourceFileName = path.relative(path.dirname(outputFilename), inputFilename);

        let { code, map } = await babel.transformFileAsync(inputFilename, {
          sourceMap: true,
          sourceFileName,
          presets: [],
          plugins: [],
        });

        code += `
//# sourceMappingURL=./${path.basename(outputFilename)}.map`;

        fs.outputFileSync(outputFilename, code);
        fs.outputJsonSync(`${outputFilename}.map`, map);

        console.log(chalk.green(`> transpiled\t ${inputFilename}`));
        return Promise.resolve();
      } catch (err) {
        console.error(chalk.red('- transpile error:'));
        console.error(err.message);
        return Promise.resolve();
      }
    } else {
      try {
        fs.ensureDirSync(path.dirname(outputFilename));
        fs.copyFileSync(inputFilename, outputFilename);
        console.log(chalk.green(`> copied\t ${inputFilename}`));
        return Promise.resolve();
      } catch(err) {
        console.error(err.message);
        return Promise.resolve();
      }
    }
  }

  if (!watch) {
    const files = klawSync(inputFolder);
    const relFiles = files.map(f => path.relative(process.cwd(), f.path));
    const promises = relFiles.map(f => compileOrCopy(f));
    return Promise.all(promises);
  } else {
    const chokidarOptions = watch ? { ignoreInitial: true } : {};
    const watcher = chokidar.watch(inputFolder, chokidarOptions);

    watcher.on('add', pathname => compileOrCopy(pathname));
    watcher.on('change', pathname => compileOrCopy(pathname));
    watcher.on('unlink', pathname => {
      const outputFilename = pathname.replace(inputFolder, outputFolder);
      fs.unlinkSync(outputFilename);
    });

    return Promise.resolve();
  }
}

async function bundle(inputFile, outputFile, watch, minify) {
  let mode = 'development';
  let devTools = 'source-map';

  const babelPresets = [
    [require.resolve('@babel/preset-env')]
  ];

  // production
  if (minify) {
    mode = 'production';
    devTools = false;
  }

  let config = {
    mode: mode,
    devtool: devTools,
    entry: inputFile,
    // 'es5' flag is important to support iOS 9.3
    // see https://stackoverflow.com/questions/54039337/how-to-remove-arrow-functions-from-webpack-output
    // target: ['web', 'es5'],
    target: ['web'],
    cache: {
      type: 'filesystem',
    },
    output: {
      path: path.dirname(outputFile),
      filename: path.basename(outputFile),
    },
    module: {
      rules: [
        {
          test: supportedFilesRegExp,
          use: {
            loader: require.resolve('babel-loader'),
            options: {
              cacheDirectory: true,
              // this makes errors more readable in browsers' console. As the file
              // is in any case also simply transpiled by babel we also have the
              // error with syntaxx highlighting in the terminal console
              highlightCode: false,
              presets: babelPresets,
              plugins: [
                // [require.resolve('@babel/plugin-transform-arrow-functions')],
                // [require.resolve('@babel/plugin-proposal-class-properties')],
              ],
            }
          }
        },
        // simple hack to inline WebWorkers
        // @todo - needs review to have common syntax client side and server side
        // as well as to handle AudioWorlet...
        {
          resourceQuery: /inline/,
          type: 'asset/source',
        },
      ],
    },
  };

  // allow extending webpack config sfrom application
  const webpackExtend = path.join(cwd, 'webpack.config.js');

  if (fs.existsSync(webpackExtend)) {
    let module = await import(webpackExtend);
    config = module.default(config);
  }

  // @todo - if the target application have some webpack.config.js file
  // it should be taken into account
  const compiler = webpack(config);

  function filterStackTrace(err) {
    return err.toString()
      .split(/[\r\n]+/)
      .filter(line => ! line.match(/^\s+at/))
      .join(os.EOL);
  }

  if (!watch) {
    return new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err || stats.hasErrors()) {
          // console.log(stats.compilation.errors[0].error.code);
          // no need to log these errors in the console, this is already done by babel
          if (stats.compilation.errors[0].error.code !== 'BABEL_PARSE_ERROR') {
            const err = filterStackTrace(stats.compilation.errors[0]);
            console.error(chalk.red('- build error:'));
            console.error(err);
          }

          console.error(chalk.red(`- build failed   ${outputFile.replace(cwd, '')}`));
          resolve();
          return;
        }

        console.log(chalk.green(`> bundled\t ${outputFile.replace(cwd, '')}`));
        resolve();
      });
    });
  } else {
    let initial = true;
    // we can't ignore initial build, so let's keep everything sequencial
    return new Promise((resolve, reject) => {
      const watching = compiler.watch({
        aggregateTimeout: 300,
        poll: undefined
      }, (err, stats) => { // Stats Object
        if (err || stats.hasErrors()) {
          // no need to log these errors in the console, this is already done by babel
          const err = filterStackTrace(stats.compilation.errors[0]);
          console.error(chalk.red('- build error:'));
          console.error(err);

          console.error(chalk.red(`- build failed   ${outputFile.replace(cwd, '')}`));
          initial = false; // if next build works we want to log it
          resolve();
          return;
        }

        // do not log the first build, this is confusing
        if (!initial) {
          console.log(chalk.green(`> bundled\t ${outputFile.replace(cwd, '')}`));
        }

        initial = false;
        resolve();
      });
    });
  }
}


export default async function buildApplication(watch = false, minifyBrowserClients = false) {
  /**
   * BUILD STRATEGY
   * -------------------------------------------------------------
   *
   * cf. https://github.com/collective-soundworks/soundworks/issues/23
   *
   * 1. copy * from `src` into `.build` keeping file system and structure
   *    intact, we keep the copy to allow further support (typescript, etc.)
   * 2. find browser clients in `src/clients` from `config/application`
   *    and build them into .build/public` using` webpack
   *
   * @note:
   * - exit with error message if `src/public` exists (reserved path)
   *
   * -------------------------------------------------------------
   */

  if (fs.existsSync(path.join('src', 'public'))) {
    console.error(chalk.red(`[@soundworks/template-build]
> The path "src/public" is reserved by the application build process.
> Please rename this file or directory, and restart the build process`));
    process.exit(0);
  }

  // transpiling `src` to `.build`
  {
    const cmdString = watch ? 'watching' : 'transpiling';
    console.log(chalk.yellow(`+ ${cmdString} \`src\` to \`.build\``));

    await transpile('src', '.build', watch);
  }

  // building "browser" clients from `src` to `.build/public`
  {
    const cmdString = watch ? 'watching' : 'building';
    let clientsConfig = null;
    // parse config/application
    try {
      const configData = fs.readFileSync(path.join(cwd, 'config', 'application.json'));
      const config = JSON5.parse(configData);
      clientsConfig = config.clients;
    } catch(err) {
      console.error(chalk.red(`[@soundworks/build] Invalid \`config/application.json\` file`));
      process.exit(0);
    }

    // find "browsers" clients paths
    const clientsSrc = path.join('src', 'clients');
    const filenames = fs.readdirSync(clientsSrc);
    const clients = filenames
      .filter(filename => {
        const relPath = path.join(clientsSrc, filename);
        const isDir = fs.lstatSync(relPath).isDirectory();
        return isDir;
      }).filter(dirname => {
        return clientsConfig[dirname] && clientsConfig[dirname].target === 'browser';
      });

    // the for loop is needed to keep things synced
    for (let clientName of clients) {
      console.log(chalk.yellow(`+ ${cmdString} browser client "${clientName}"`));

      const jsInput = path.join(cwd, '.build', 'clients', clientName, 'index.js');
      // const tsInput = path.join(cwd, '.build', 'clients', clientName, 'index.ts');
      const inputFile = path.join(cwd, '.build', 'clients', clientName, 'index.js');

      // if (fs.existsSync(jsInput)) {
      //   inputFile = jsInput;
      // } else if (fs.existsSync(tsInput)) {
      //   inputFile = tsInput;
      // } else {
      //   throw new Error(`[@soundworks/build] Invalid client entry point for "${clientName}", no "input.js" nor "input.ts" file found`);
      // }

      // console.log(inputFile);

      const outputFile = path.join(cwd, '.build', 'public', `${clientName}.js`);
      await bundle(inputFile, outputFile, watch);

      if (minifyBrowserClients) {
        console.log(chalk.yellow(`+ minifying browser client "${clientName}"`));

        const minOutputFile = path.join(cwd, '.build', 'public', `${clientName}.min.js`);

        await bundle(inputFile, minOutputFile, watch, true);
      }
    }
  }

  process.on('SIGINT', function() {
    console.log(chalk.cyan('\n>>> EXIT'))
    process.exit();
  });
}


