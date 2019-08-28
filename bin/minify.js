#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const Terser = require('terser');

module.exports = function minify() {
  const publicJsDirectory = path.join('.build', 'public');
  fs.ensureDirSync(publicJsDirectory);

  let files;

  files = fs.readdirSync(publicJsDirectory);
  // delete old minified files
  files.forEach(filename => {
    if (/\.min\.js$/.test(filename)) {
      // delete file
      fs.unlinkSync(path.join(publicJsDirectory, filename));
    }
  });

  files = fs.readdirSync(publicJsDirectory);

  files.forEach(filename => {
    if (/\.js$/.test(filename)) {
      const inputFilename = path.join(publicJsDirectory, filename);
      const outputFilename = inputFilename.replace(/\.js$/, '.min.js');
      const code = fs.readFileSync(inputFilename, 'utf-8');
      const result = Terser.minify(code);
      fs.writeFileSync(outputFilename, result.code);

      console.log(chalk.green(`> minified\t ${inputFilename}`));
    }
  });
}
