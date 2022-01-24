const sh = require('shelljs');

// sudo locale-gen en_US.utf8 (FOR MOSH)
// TODO: Log everything that happens on the client to a file
// TODO: Read the commands to send from the actual documentation files
// TODO: Make username and passwords configurable
// TODO: Capture entire histories and not just the current buffer, either cumulatively or all at once

// Configuration
// TODO: Move to JSON file 
let config = {
    network: '192.168.1.',
    ssh: {
        options: '-o "StrictHostKeyChecking=no" -o "BatchMode=yes"'
    }
};

// Shells should be silent 
sh.config.silent = true;

// Shut down any running vms
for (let vm of sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local VBoxManage list runningvms`).stdout.trim().split("\n")) {
    vm = vm.split(' {')[0];
    if (/Clone\"/.test(vm)) {
        console.log(`Shutting down ${vm}`);
        sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local 'VBoxManage controlvm ${vm} poweroff'`);
    }
}

// Delete any Clone vms 
for (let vm of sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local VBoxManage list vms`).stdout.trim().split("\n")) {
    vm = vm.split(' {')[0];
    if (/Clone\"/.test(vm)) {
        console.log(`Deleting ${vm}`);
        sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local 'VBoxManage unregistervm ${vm} --delete'`);
    }
}

// Clone the vms
for (let vm of '"Wire Demo Client","Wire Demo Server"'.split(',')) {
    console.log(`Creating clone for «${vm}»`);
    sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local 'VBoxManage clonevm ${vm} --snapshot=running --options=KeepAllMACs,Link --register'`);
}

// Start any Clone vm 
for (let vm of sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local VBoxManage list vms`).stdout.trim().split("\n")) {
    vm = vm.split(' {')[0];
    if (/Clone\"/.test(vm)) {
        console.log(`Starting ${vm}`);
        sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local 'VBoxManage startvm ${vm} --type headless'`);
    }
}

// List running machines
console.log("Running virtual machines:")
for (let vm of sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local VBoxManage list runningvms`).stdout.trim().split("\n")) { console.log(vm.split(' {')[0]) }


// Find all machines on the local network
let machines = sh.exec(`nmap -sn '${config.network}*'`).stdout.split("\n").map(x => x.match(RegExp(`(${config.network}\\d+)`, 'g'))).filter(x => x).map(x => x[0]);
// TODO: Test that there is more than zero machines

// Use SSH to find the ones that answer to the default login/pass
for (let target of machines) {
    let host = sh.exec(`ssh ${config.ssh.options} wire@${target} cat /etc/hostname`).stdout.trim();
    if (/(wire-(client|server)|kubenode01)/.test(host)) { config[host] = target }
}

// In case the host was already configured (repeat runs)
if (config['kubenode01']) { config['wire-server'] = config['kubenode01'] }

// TODO: Test that both wire-client and wire-server were found

console.log(config);

// Install tmux's latest version on the client and server
for (let target of "client server".split(' ')) {
    sh.exec(`ssh ${config.ssh.options} wire@${config[`wire-${target}`]} wget https://github.com/nelsonenzo/tmux-appimage/releases/download/tmux3.1b/tmux-3.1b-x86_64.AppImage -O .tmux`);
    sh.exec(`ssh ${config.ssh.options} wire@${config[`wire-${target}`]} chmod +x .tmux`);
}

// Automatic answers 
let answers = [
    [/Do you want to continue/gi, "y Enter"],
    [/(sudo.*password for wire|wire@.*s password)/gi, "changeme Enter"],
    [/^Please type .* or the fingerprint/gi, "yes Enter"],
    [/^Overwrite \(y\/n\)\?/gi, "y Enter"],
    [/^Are you sure you want to continue connecting/gi, "yes Enter"]
];

// Send a command to the remote tmux 
function remote(target, cmd) {
    target = config[`wire-${target}`];
    sh.exec(`ssh ${config.ssh.options} wire@${target} ./.tmux new -d -s install`);
    sh.exec(`ssh ${config.ssh.options} wire@${target} ./.tmux clear-history -t install`);
    sh.exec(`ssh ${config.ssh.options} wire@${target} ./.tmux send-keys -t install "clear Enter"`);
    sh.exec(`ssh ${config.ssh.options} wire@${target} ./.tmux send-keys -t install -l -H ${cmd.split('').map(x => x.charCodeAt(0).toString(16)).join(' ')} 0A`);
    while (1) {
        sh.exec(`ssh ${config.ssh.options} wire@${target} ./.tmux capture-pane -S -32768 -t install -b capture`);
        let result = sh.exec(`ssh ${config.ssh.options} wire@${target} ./.tmux show-buffer -b capture`).stdout.trim();
        let lastline = result.split("\n").pop();
        for (let answer of answers) {
            if (answer[0].test(lastline)) {sh.exec(`ssh ${config.ssh.options} wire@${target} ./.tmux send-keys -t install "${answer[1]}"`)}
        }
        if (/^(wire@(wire-(client|server)|kubenode01)|bash-[\d\.-]*\#)/gi.test(lastline) && result.split("\n").length > 1) {
            let lines = result.split("\n");
            lines.pop();
            return lines.join("\n");
        }
        sh.exec("sleep 0.2");
    }
}

// TODO: Exit if the pront is "bash-x.x#", it means we didn't exit properly

// Basic setup and test
console.log(client.ssh.run( "cd"));
console.log(client.ssh.run( "cat /etc/hostname"));
console.log(client.ssh.run( "pwd"));

// Cleanup for convenience of repeated runs 
// TODO: Remove this, this is only for testing/coding
console.log(client.ssh.run( "sudo rm -rf /home/wire/wire*"));
console.log(client.ssh.run( "ls -l /home/wire/"));

// Actual installation process

// Step: Prepare apt on client to make sure we do not try to use a previously broken apt
console.log(client.ssh.run( "sudo apt update"));
console.log(client.ssh.run( "sudo dpkg --configure -a"));

// Step: Prepare apt on server to make sure we do not try to use a previously broken apt
console.log(server.ssh.run( "sudo apt update"));
console.log(server.ssh.run( "sudo dpkg --configure -a"));

// Step: Git
console.log(client.ssh.run( "git clone --branch master https://github.com/wireapp/wire-server-deploy.git"));
console.log(client.ssh.run( "ls -l"));
console.log(client.ssh.run( "cd wire-server-deploy"));
console.log(client.ssh.run( "pwd"));
console.log(client.ssh.run( "ls -l"));
console.log(client.ssh.run( "git submodule update --init --recursive"));

// Step: Docker 
console.log(client.ssh.run( "sudo apt install docker.io"));
console.log(client.ssh.run( "docker -v"));
console.log(client.ssh.run( 'WSD_CONTAINER=quay.io/wire/wire-server-deploy:cdc1c84c1a10a4f5f1b77b51ee5655d0da7f9518'));
console.log(client.ssh.run( 'sudo docker run -it --network=host -v ${SSH_AUTH_SOCK:-nonexistent}:/ssh-agent -v $HOME/.ssh:/root/.ssh -v $PWD:/wire-server-deploy -e SSH_AUTH_SOCK=/ssh-agent $WSD_CONTAINER bash'));
console.log(client.ssh.run( "ansible --version"));

// Step: Inside the docker
console.log(client.ssh.run( "cd ansible"));
console.log(client.ssh.run( "pwd"));
console.log(client.ssh.run( "cp inventory/demo/hosts.example.ini inventory/demo/hosts.ini"));
console.log(client.ssh.run( "ls -l inventory/demo/hosts.ini"));
console.log(client.ssh.run( `sed -i 's/X.X.X.X/${config['wire-server']}/g' inventory/demo/hosts.ini`));
console.log(client.ssh.run( `cat inventory/demo/hosts.ini | grep ansible_host`));

// Step: Set up passwordless sudo on the server, client-side part
console.log(client.ssh.run( "ssh-keygen -f /root/.ssh/id_rsa -t rsa -P ''"));
console.log(client.ssh.run( `ssh-copy-id wire@${config['wire-server']}`));

// Step: Set up passwordless sudo on the server, server-side part
console.log(server.ssh.run( `cat /etc/hostname`));
console.log(server.ssh.run( `sudo tail -n 2 /etc/sudoers`));
console.log(server.ssh.run( `echo 'wire ALL=(ALL) NOPASSWD:ALL' | sudo tee -a /etc/sudoers`));
console.log(server.ssh.run( `sudo tail -n 2 /etc/sudoers`));

// Step: configure ansible to use the passwordless sudo wire user on the server
console.log(client.ssh.run( `cat inventory/demo/hosts.ini | grep ansible_user`));
console.log(client.ssh.run( "sed -i 's/# ansible_user = .../ansible_user = wire/g' inventory/demo/hosts.ini"));
console.log(client.ssh.run( `cat inventory/demo/hosts.ini | grep ansible_user`));

// Step: Run ansible 
console.log(client.ssh.run( "ansible-playbook -i inventory/demo/hosts.ini kubernetes.yml -vv"));

// Step: Kube 
console.log(client.ssh.run( "find . -name 'admin.conf'"));
console.log(client.ssh.run( "mkdir -p ~/.kube/"));
console.log(client.ssh.run( "cp ./inventory/demo/artifacts/admin.conf ~/.kube/config"));
console.log(client.ssh.run( "KUBECONFIG=~/.kube/config"));
console.log(client.ssh.run( "which kubectl"));
console.log(client.ssh.run( "kubectl version"));
console.log(client.ssh.run( "kubectl get pods -A "));

// Step: Helm 
console.log(client.ssh.run( "helm version"));
console.log(client.ssh.run( "helm repo add wire https://s3-eu-west-1.amazonaws.com/public.wire.com/charts"));
console.log(client.ssh.run( "kubectl get pods -A"));

// Remember to always exit 
console.log(client.ssh.run( "exit"));

// TODO: Stop the virtual machines, delete the clones
// tmux attach-session -t

// Shut down any running vms
for (let vm of sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local VBoxManage list runningvms`).stdout.trim().split("\n")) {
    vm = vm.split(' {')[0];
    if (/Clone\"/.test(vm)) {
        console.log(`Shutting down ${vm}`);
        sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local 'VBoxManage controlvm ${vm} poweroff'`);
    }
}

// Delete any Clone vms 
for (let vm of sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local VBoxManage list vms`).stdout.trim().split("\n")) {
    vm = vm.split(' {')[0];
    if (/Clone\"/.test(vm)) {
        console.log(`Deleting ${vm}`);
        sh.exec(`ssh ${config.ssh.options} arthur@robotseed-laptop.local 'VBoxManage unregistervm ${vm} --delete'`, { silent: false });
    }
}