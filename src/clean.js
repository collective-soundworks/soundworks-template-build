import chalk from 'chalk';
import rimraf from 'rimraf';

export default function clean() {
  rimraf('.build', () => console.log(chalk.yellow(`+ deleted build folder`)));
}
