const sh = require('shelljs');

// Shells should be silent 
sh.config.silent = true;

// Virtual machine controlling class
module.exports = class VM {

    constructor(options) {
        this.options = options;
        this.logger = options.logger;
    }

    // TODO: Make arthur@robotseed-laptop.local configurable, and make it not presumed we can connect to it via ssh (we can't by default)

    // Run a command 
    run(command) {
        let result = sh.exec(command);
        if (result.stderr) { console.log(result.stderr) }
        return result;
    }

    // Shut off the machine 
    shut_off() {
        this.logger.log(`# Shutting down virtual machine "${this.options.clone} Clone"`);
        this.run(`ssh -o "StrictHostKeyChecking=no" -o "BatchMode=yes" arthur@robotseed-laptop.local 'VBoxManage controlvm "${this.options.clone} Clone" poweroff'`);

    }

    // Delete the current clone 
    delete_clone() {
        this.logger.log(`# Deleting virtual machine "${this.options.clone} Clone"`);
        this.run(`ssh -o "StrictHostKeyChecking=no" -o "BatchMode=yes" arthur@robotseed-laptop.local 'VBoxManage unregistervm "${this.options.clone} Clone" --delete'`);
    }

    // Create a new clone 
    create_clone() {
        this.logger.log(`# Creating virtual machine "${this.options.clone} Clone" from snapshot`);
        this.run(`ssh -o "StrictHostKeyChecking=no" -o "BatchMode=yes" arthur@robotseed-laptop.local 'VBoxManage clonevm "${this.options.clone}" --snapshot=running --options=KeepAllMACs,Link --register'`);
    }

    // Start the clone 
    start() {
        this.logger.log(`# Starting virtual machine "${this.options.clone} Clone"`);
        this.run(`ssh -o "StrictHostKeyChecking=no" -o "BatchMode=yes" arthur@robotseed-laptop.local 'VBoxManage startvm "${this.options.clone} Clone" --type headless'`);
    }

    // TODO: Method to check if a given vm is actually running, and call that from the main

}