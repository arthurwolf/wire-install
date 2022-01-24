const fs = require('fs');

// Log command output into a file
module.exports = class Logger {

    constructor() {
        let date = Date().split(' ');
        this.file = `wire-install-${date[3]}-${date[1]}-${date[2]}-${date[4].split(':').join('-')}.log`;
        this.log(`# Logging to: ${this.file} in log/ and tmp/`);
    }

    // Log data to the log file (and display)
    log(data) {
        data = `[${Date().split(' ')[4]}] ${data}`;
        console.log(data);
        fs.writeFileSync('/tmp/' + this.file, data + "\n", { flag: 'a+' });
        fs.writeFileSync('log/' + this.file, data + "\n", { flag: 'a+' });

    }

}