#!/usr/bin/env node
const path = require('path');
const babel = require('@babel/core');
const chalk = require('chalk')
const chokidar = require('chokidar');
const fs = require('fs-extra');
const webpack = require('webpack');
const JSON5 = require('json5');
const klawSync = require('klaw-sync');

const cwd = process.cwd();

// we need support for iOS 9.3.5
const browserList = 'ios >= 9, not ie 11, not op_mini all';

/**
 * All babel plugins we use are contained in the preset-env, so no need to
 * have them in dependencies.
 */
function transpile(inputFolder, outputFolder, watch) {
  function compileOrCopy(pathname) {
    if (fs.lstatSync(pathname).isDirectory()) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const inputFilename = pathname;
      // TODO: Check if .tsx support is working as expected
      const outputFilename = inputFilename.replace(inputFolder, outputFolder).replace('.tsx', '.jsx').replace('.ts', '.js');
      fs.ensureFileSync(outputFilename);

      if (/(\.js|\.mjs|\.ts|\.tsx)$/.test(inputFilename)) {
        babel.transformFile(inputFilename, {
          inputSourceMap: true,
          sourceMap: "inline",
          plugins: [
            // clean resolve even if using `npm link`:
            // https://github.com/facebook/create-react-app/blob/7408e36478ea7aa271c9e16f51444547a063b400/packages/babel-preset-react-app/index.js#L15
            [require.resolve("@babel/plugin-transform-typescript")],
            [require.resolve('@babel/plugin-transform-modules-commonjs')],
            [require.resolve('@babel/plugin-proposal-class-properties')]
          ]
        }, function (err, result) {
          if (err) {
            return console.log(err.message);
            reject();
          }

          resolve();
          fs.writeFileSync(outputFilename, result.code);
          console.log(chalk.green(`> transpiled\t ${inputFilename}` + ( (inputFilename.includes(".ts"))?` to ${outputFilename}`:'')));
        });
      } else {
        fs.copyFileSync(inputFilename, outputFilename);
        console.log(chalk.green(`> copied\t ${inputFilename}`));
        resolve();
      }
    });
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

function bundle(inputFile, outputFile, watch, minify) {
  let mode = 'development';
  let devTools = 'eval-cheap-module-source-map';

  const babelPresets = [
    [require.resolve('@babel/preset-typescript')],
    [require.resolve('@babel/preset-env'),
      {
        targets: browserList,
      }
    ]
  ];

  // production
  if (minify) {
    mode = 'production';
    devTools = false;

    // babelPresets.push([require.resolve('minify'), {
    //   builtIns: false,
    // }]);
  }

  // TODO: Check if .tsx support is also needed
  const compiler = webpack({
    mode: mode,
    devtool: devTools,
    entry: inputFile,
    output: {
      path: path.dirname(outputFile),
      filename: path.basename(outputFile),
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".json", ".jsx"],
    },
    // resolveLoader: {
    //   modules: ['node_modules', path.join(__dirname, '..', 'node_modules')]
    // },
    module: {
      rules: [
        {
          test: /\.(js|mjs|ts|tsx)$/,
          // 'exclude': /node_modules/,
          use: {
            loader: require.resolve('babel-loader'),
            options: {
              presets: babelPresets,
              plugins: [
                // ['@babel/plugin-transform-modules-commonjs'],
                [require.resolve('@babel/plugin-transform-arrow-functions')],
                [require.resolve('@babel/plugin-proposal-class-properties')],
                [require.resolve('@babel/plugin-proposal-object-rest-spread')]
              ],
            }
          }
        }
      ]
    }
  });

  if (!watch) {
    return new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err || stats.hasErrors()) {
          console.log(stats.compilation.errors);
        }

        console.log(chalk.greenBright(`> bundled\t ${outputFile.replace(cwd, '')}`));
        resolve();
      });
    });
  } else {
    // we can't ignore initial build, so let's keep everything sequencial
    return new Promise((resolve, reject) => {
      const watching = compiler.watch({
        aggregateTimeout: 300,
        poll: undefined
      }, (err, stats) => { // Stats Object
        if (err || stats.hasErrors()) {
          console.log(stats.compilation.errors);
        }

        console.log(chalk.green(`> bundled\t ${outputFile.replace(cwd, '')}`));
        resolve();
      });
    });
  }
}


module.exports = async function buildApplication(watch = false, minifyBrowserClients = false) {
  /**
   * BUILD STRATEGY
   * -------------------------------------------------------------
   *
   * cf. https://github.com/collective-soundworks/soundworks/issues/23
   *
   * 1. transpile * from `src` into `build` using `babel` keeping file system
   *    and structure intact
   * 2. find browser clients in `src/clients` from `config/application`
   *    and build them into .build/public` using` webpack
   *
   * @note:
   * - exit with error message if `src/public` exists (reserved path)
   *
   * -------------------------------------------------------------
   */

  if (fs.existsSync(path.join('src', 'public'))) {
    console.log(chalk.red(`[@soundworks/template-build]
> The path "src/public" is reserved by the application build process.
> Please rename this file or directory, and relaunch the build process`));
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
      clientsConfig = config.clients
    } catch(err) {
      console.log(chalk.red(`[@soundworks/template-build]
> Invalid \`config/application.json\` file`));
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

      // Note: We first try to read the index.js file, if it doesn't exist we try the .ts version
      var inputFile = path.join(cwd, 'src', 'clients', clientName, 'index.js');
      try {
        if (!fs.existsSync(inputFile)) {
          //console.log(chalk.gray("Note: index.js does not exist, trying .ts file..."))
          inputFile = path.join(cwd, 'src', 'clients', clientName, 'index.ts');
        }
      } catch(err) {
        console.error(err)
      }

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


