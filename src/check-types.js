const chalk = require('chalk');
const { execSync } = require('child_process');
const path = require('path');
const cwd = process.cwd();

module.exports = function checkTypes(processArgv) {
    var tscPath = path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc');
    var tscConfigPath;
    // Parse the config path out of the command line arguments
    if (processArgv.length === 4 && processArgv[3] !== "") {
        tscConfigPath = path.join(cwd, processArgv[3])
        console.log(chalk.magenta(`Using:`) + tscConfigPath);
    } else {
        throw("No tsconfig file specified, please provide one along with the call...");
    }

    // We use the sync task here, because the async task is not supporting a colored output
    execSync(`node ${tscPath} --build ${tscConfigPath}`,
        {stdio: 'inherit'}
    );

    console.log(chalk.magenta(`Type checking successful.`));
}
