const sh = require('shelljs');
const Remote = require('./remote');
const VM = require('./vm');

// Shells should be silent 
sh.config.silent = true;

// The machine is just a convenience container for an IP, a remote/ssh object and a virtualmachine object

module.exports = class Machine {

    constructor(options) {
        this.options = options;

        // Create the remote 
        this.ssh = new Remote(options);

        // Create the vm 
        this.vm = new VM(options)
    }

    // Set the IP
    set_ip(ip) {
        this.options.ip = ip;
        this.ssh.options.ip = ip;
        this.vm.options.ip = ip;
    }
}