const sh = require('shelljs');

// Shells should be silent 
sh.config.silent = true;

// Scan the network and return machines matching a given characteristic
module.exports = class Scanner {

    constructor(config) { this.config = config }

    // Search machines matching this search term and return them

    search(search_term) {
        let machines = [];

        // Search until two hosts are returned
        //while (machines.length != 2) { // TODO: Put this pback in 
        let ips = sh.exec(`nmap -sn '${this.config.network}*'`).stdout.split("\n").map(x => x.match(RegExp(`(${this.config.network}\\d+)`, 'g'))).filter(x => x).map(x => x[0]);
        for (let ip of ips) {
            let host = sh.exec(`ssh -o "StrictHostKeyChecking=no" -o "BatchMode=yes" wire@${ip} cat /etc/hostname`).stdout.trim();
            if (/(wire-(client|server)|kubenode01)/.test(host)) { machines.push({ host: host, ip: ip }) }
        }
        //}
        return machines;
    }

}