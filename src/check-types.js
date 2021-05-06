const chalk = require('chalk');
const { exec, execSync } = require('child_process');
const path = require('path');

module.exports = function checkTypes() {
    var tscPath = path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc');
    var tscConfigPath = path.join(__dirname, '..', 'tsconfig.json');

    /* Note: This is the asynchronous way. Sadly, this is not logging the colored text, but only the stdout
    var child = exec(`node ${tscPath} --build ${tscConfigPath}`, {stdio: "inherit"}, (error, stdout, stderr) => {
        if (error) {
            console.log(chalk.red(`error: ${error.message}`));
            throw(error);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
    });

    child.stdout.on('data', function(data) {
        console.log(data.toString()); 
    });

    child.on('exit', function(code){
        console.log(code);
    }); */

    var tscTask = execSync(`node ${tscPath} --build ${tscConfigPath}`,
        {stdio: 'inherit'}
    );

    console.log(chalk.magenta(`Type checking done!`));
}
