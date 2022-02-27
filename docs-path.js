const Machine = require('./lib/machine');
const Scanner = require('./lib/scanner');
const Logger  = require('./lib/logger');
const Docs    = require('./lib/docs');
const sh      = require('shelljs');
const YAML    = require('yaml');


// sudo locale-gen en_US.utf8 (FOR MOSH)
// TODO: Log everything that happens on the client to a file
// TODO: Read the commands to send from the actual documentation files (after first cloning wire-docs automatically)
// TODO: Make username and passwords configurable. Make sure it gets passed to the "remote" plugin etc
// TODO: Capture entire histories and not just the current buffer, either cumulatively or all at once
// TODO: Merge docker-path and nix-path into a single script with command line options

// Configuration
// TODO: Move to JSON file 
let config = {
    network: '192.168.1.',
    wire_user: 'root', //was: "wire"
    home_folder: '/root/',
};

// Logger to save command output 
let logger = new Logger();

// 159.69.208.221 and 159.69.199.136

// Create the machines 
let client = new Machine({ ip: "159.69.208.221", user: config.wire_user, clone: "Wire Demo Client", logger: logger });
let server = new Machine({ ip: "159.69.199.136", user: config.wire_user, clone: "Wire Demo Server", logger: logger }); //was: 95.216.208.159

// In case the host was already configured (repeat runs) and its hostname has now changed. This should at least throw a warning in case we did not intend a repeat run.
// Or used for fixed-IP setups to save the time of scanning
config['wire-client'] = "159.69.208.221";
config['wire-server'] = "159.69.199.136"; //"95.216.208.159";

// We found each IP 
client.set_ip(config['wire-client']);
server.set_ip(config['wire-server']);

// TODO: Create the wire user on the server if it does not exist (and client?), and ssh-copy-id and visudo

//sh.exec('sleep 20');
// Exit before we do anything in case we were in the docker bash
// client.ssh.run(`exit`);
// server.ssh.run(`exit`);

// TODO: Test if the server answers the way it should after the process is finished. At this point, it shouldn't, and if it does, we didn't reset correctly.

// Before anything else, set the date on both client and server (otherwise APT might break from waking up an out-of-date VM)
// client.ssh.run(`sudo date --set="${new Date()}"`);
// server.ssh.run(`sudo date --set="${new Date()}"`);

// Step: Git install
//client.ssh.run("sudo apt install git");
//client.ssh.run("git --version");


// Parse docs
let docs = [
    new Docs('dependencies.rst'),
    new Docs('kubernetes.rst'),
    new Docs('helm.rst'),
];



// For each doc, run each test
for(let doc of docs){

    // Run each test
    for(let test of doc.tests){

        logger.log(JSON.stringify(test));


        // Result of the command
        let result = '';

        // Run the test
        // Where depends on the "on" test property:
        let target = null;
        switch(test.on){
            case 'client': target = client; break;
            case 'server': target = server; break;
            default: throw(`Tests's 'on' property was not one of client or server, for test ${test.name}`);
        }

        // If needed, check that we start in the right folder
        if(test.before_should_be_in){
            // Check if we are in the right folder
            if(target.ssh.run("pwd").includes("pwd\n" + test.after_should_be_in)){
                logger.log(`We are in the right folder before running this command, continuing`);
            }else{
                throw(`We are in the wrong folder before running this command, should be ${test.after_should_be_in}, but instead is ${target.ssh.run("pwd").split("\n")[0]}`);
            }
        }

        // Run each command
        for(let command of test.commands){
            // Run the command
            result += target.ssh.run(command);
        }

        logger.log(JSON.stringify({lines: result.split("\n").length}));

        // If needed, check that the result is as expected
        if(test.must_contain){
            // Create matching regular expression
            const must_contain = new RegExp(test.must_contain, 'ig');

            // Test for the regular expression
            if(must_contain.test(result)){
                logger.log(`Regular expression /${test.must_contain}/ig did match the output of this command`);
            }else{
                throw(     `Regular expression /${test.must_contain}/ig did not match the output of this command`);
            }
        }

        // If needed, check that we ended up in the right folder
        if(test.after_should_be_in){
            // Check if we are in the right folder
            if(target.ssh.run("pwd").includes("pwd\n" + test.after_should_be_in)){
                logger.log(`We are in the right folder after running this command, continuing`);
            }else{
                throw(`We are in the wrong folder after running a command, should be ${test.after_should_be_in}, but instead is ${target.ssh.run("pwd").split("\n")[1]}`);
            }
        }

    }
}
