const Machine = require('./lib/machine');
const Scanner = require('./lib/scanner');
const Logger = require('./lib/logger');

// sudo locale-gen en_US.utf8 (FOR MOSH)
// TODO: Log everything that happens on the client to a file
// TODO: Read the commands to send from the actual documentation files
// TODO: Make username and passwords configurable. Make sure it gets passed to the "remote" plugin etc
// TODO: Capture entire histories and not just the current buffer, either cumulatively or all at once


// Configuration
// TODO: Move to JSON file 
let config = {
    network: '192.168.1.',
    wire_user: 'wire',
};

// Logger to save command output 
let logger = new Logger();

// Create the machines 
let client = new Machine({ ip: config['wire-client'], user: config.wire_user, clone: "Wire Demo Client", logger: logger });
let server = new Machine({ ip: "95.216.208.159", user: config.wire_user, clone: "Wire Demo Server", logger: logger });


/*
// For each machine, do VM tasks 
for (let machine of[client]) {
    machine.vm.shut_off(); // Shut off the machine 
    machine.vm.delete_clone(); // Delete the current clone 
    machine.vm.create_clone(); // Create a new clone 
    machine.vm.start(); // Start the clone 
}
*/

// Scan the network 
/*let scan = new Scanner(config);
for (let machine of scan.search(/wire-client/)) {
    config[machine.host] = machine.ip
}*/

// In case the host was already configured (repeat runs) and its hostname has now changed. This should at least throw a warning in case we did not intend a repeat run.
config['wire-server'] = "95.216.208.159";
config['wire-client'] = "192.168.1.121";

// We found each IP 
client.set_ip(config['wire-client']);
server.set_ip(config['wire-server']);

console.log(config);

/*
// Before anything else, set the date on both client and server (otherwise APT might break from waking up an out-of-date VM)
client.ssh.run(`sudo date --set="${new Date()}"`);

// Step: Prepare apt on client to make sure we do not try to use a previously broken apt
client.ssh.run("sudo apt update");
client.ssh.run("sudo dpkg --configure -a");
client.ssh.run("sudo apt install docker.io");
client.ssh.run("docker -v");
*/

client.ssh.run("curl -sSL https://raw.githubusercontent.com/wireapp/wire-server-deploy/master/values/wire-server/demo-secrets.example.yaml > secrets.yaml");
client.ssh.run("curl -sSL https://raw.githubusercontent.com/wireapp/wire-server-deploy/master/values/wire-server/demo-values.example.yaml > values.yaml");
client.ssh.run("openssl rand -base64 64 | env LC_CTYPE=C tr -dc a-zA-Z0-9 | head -c 42 > restund.txt");
client.ssh.run("sudo docker run --rm quay.io/wire/alpine-intermediate /dist/zauth -m gen-keypair -i 1 > zauth.txt");

// Parse the output
let restund = client.ssh.run("cat restund.txt && echo").trim().split('\n')[1];
let zauth = client.ssh.run("cat zauth.txt").trim().split('\n');
zauth.shift();
zauth[1] = zauth[1] + (zauth[2] || '');
zauth = {
    public: zauth[0].split(': ')[1],
    secret: zauth[1].split(': ')[1]
};
console.log(restund);
console.log(zauth);

// Actually substitute 
// sed -i 's/secret:$/secret:test/' secrets.yaml
client.ssh.run(`sed -i 's/secret:$/secret: ${restund}/' secrets.yaml`);
client.ssh.run(`sed -i 's/publicKeys: "<public key>"/publicKeys: "${zauth.public}"/' secrets.yaml`);
client.ssh.run(`sed -i 's/privateKeys: "<private key>"/privateKeys: "${zauth.secret}"/' secrets.yaml`);
client.ssh.run(`cat secrets.yaml | grep '${restund}'`);
client.ssh.run(`cat secrets.yaml | grep '${zauth.public}'`);
client.ssh.run(`cat secrets.yaml | grep '${zauth.secret}'`);


// sed -i 's/publicKeys: "<public key>"/publicKeys: "<not public key>"/' secrets.yaml



process.exit(0);

// Actual installation process

// Step: Prepare apt on client to make sure we do not try to use a previously broken apt
client.ssh.run("date");
client.ssh.run("uptime");
client.ssh.run("sudo apt update");
client.ssh.run("sudo dpkg --configure -a");

// Step: Prepare apt on server to make sure we do not try to use a previously broken apt
server.ssh.run("date");
server.ssh.run("uptime");
server.ssh.run("sudo apt update");
server.ssh.run("sudo dpkg --configure -a");

// Step: Git
client.ssh.run('git clone --branch master https://github.com/wireapp/wire-server-deploy.git');
client.ssh.run("ls -l");
client.ssh.run("cd wire-server-deploy");
client.ssh.run("pwd");
client.ssh.run("ls -l");
client.ssh.run("git submodule update --init --recursive");

// Step: Docker 
client.ssh.run("sudo apt install docker.io");
client.ssh.run("docker -v");
client.ssh.run('WSD_CONTAINER=quay.io/wire/wire-server-deploy:cdc1c84c1a10a4f5f1b77b51ee5655d0da7f9518');
client.ssh.run('sudo docker run -it --network=host -v ${SSH_AUTH_SOCK:-nonexistent}:/ssh-agent -v $HOME/.ssh:/root/.ssh -v $PWD:/wire-server-deploy -e SSH_AUTH_SOCK=/ssh-agent $WSD_CONTAINER bash');
client.ssh.run("ansible --version");

// Step: Inside the docker
client.ssh.run("cd ansible");
client.ssh.run("pwd");
client.ssh.run("cp inventory/demo/hosts.example.ini inventory/demo/hosts.ini");
client.ssh.run("ls -l inventory/demo/hosts.ini");
client.ssh.run(`sed -i 's/X.X.X.X/${config['wire-server']}/g' inventory/demo/hosts.ini`);
client.ssh.run(`cat inventory/demo/hosts.ini | grep ansible_host`);

// Step: Set up passwordless sudo on the server, client-side part
client.ssh.run("ssh-keygen -f /root/.ssh/id_rsa -t rsa -P ''");
client.ssh.run(`ssh-copy-id wire@${config['wire-server']}`);

// Step: Set up passwordless sudo on the server, server-side part
server.ssh.run(`cat /etc/hostname`);
server.ssh.run(`sudo tail -n 2 /etc/sudoers`);
server.ssh.run(`echo 'wire ALL=(ALL) NOPASSWD:ALL' | sudo tee -a /etc/sudoers`);
server.ssh.run(`sudo tail -n 2 /etc/sudoers`);

// Step: configure ansible to use the passwordless sudo wire user on the server
client.ssh.run(`cat inventory/demo/hosts.ini | grep ansible_user`);
client.ssh.run("sed -i 's/# ansible_user = .../ansible_user = wire/g' inventory/demo/hosts.ini");
client.ssh.run(`cat inventory/demo/hosts.ini | grep ansible_user`);

// Step: Run ansible 
client.ssh.run("ansible-playbook -i inventory/demo/hosts.ini kubernetes.yml -vv");

// Step: Kube 
client.ssh.run("find . -name 'admin.conf'");
client.ssh.run("mkdir -p ~/.kube/");
client.ssh.run("cp ./inventory/demo/artifacts/admin.conf ~/.kube/config");
client.ssh.run("KUBECONFIG=~/.kube/config");
client.ssh.run("which kubectl");
client.ssh.run("kubectl version");
client.ssh.run("kubectl get pods -A ");

client.ssh.run(`free -m && uptime`);
server.ssh.run(`free -m && uptime`);

// Step: Helm 
client.ssh.run("helm version");
// TODO: From docs: « In case kubectl version shows both Client and Server versions, but helm version does not show a Server version, you may need to run helm init. »
// This is what "only the server" looks like, I think: bash-4.4# helm version \n version.BuildInfo{Version:"v3.5.2", GitCommit:"", GitTreeState:"", GoVersion:"go1.16"}
// TODO: Ask the team if it's fine to just tell people to run helm init no matter what

client.ssh.run("helm repo add wire https://s3-eu-west-1.amazonaws.com/public.wire.com/charts");
client.ssh.run("helm search repo wire/");
client.ssh.run("kubectl get pods -A");
client.ssh.run("helm upgrade --install databases-ephemeral wire/databases-ephemeral --wait --debug"); // TODO: Remove debug in all helm commands 

client.ssh.run("helm upgrade --install fake-aws wire/fake-aws --wait --debug");
client.ssh.run("kubectl get pods -A");

client.ssh.run("helm upgrade --install smtp wire/demo-smtp --wait --debug");
client.ssh.run("kubectl get pods -A");

client.ssh.run(`free -m && uptime`);
server.ssh.run(`free -m && uptime`);

// At this point we get out of the docker bash 
client.ssh.run("exit");

// Install wire-server itself
client.ssh.run("cd");
client.ssh.run("pwd");
client.ssh.run("cd wire-server-deploy");
client.ssh.run("pwd");
client.ssh.run("ls -l");
client.ssh.run("mkdir -p wire-server");
client.ssh.run("cd wire-server");
client.ssh.run("pwd");

client.ssh.run("cp ../values/wire-server/demo-secrets.example.yaml secrets.yaml");
client.ssh.run("cp ../values/wire-server/demo-values.example.yaml values.yaml");
client.ssh.run("ls -l");

/*
client.ssh.run("openssl rand -base64 64 | env LC_CTYPE=C tr -dc a-zA-Z0-9 | head -c 42 > restund.txt");
client.ssh.run("sudo docker run --rm quay.io/wire/alpine-intermediate /dist/zauth -m gen-keypair -i 1 > zauth.txt");
client.ssh.run("ls -l");
let restund = client.ssh.run("cat restund.txt && echo ''").trim();
let zauth = client.ssh.run("cat zauth.txt").trim();
console.log([restund, zauth]);
*/














/*
client.ssh.run(`ping -w 5 ${config['wire-server']}`);
client.ssh.run(`ping -w 5 ${config['wire-client']}`);
client.ssh.run(`wget https://${config['wire-server']}:6443/version?timeout=32s -O -`);
client.ssh.run(`wget https://${config['wire-server']}:6443/api/v1/namespaces/default/services/redis-ephemeral-headless -O -`);
client.ssh.run(`wget --no-check-certificate https://${config['wire-server']}:6443/version?timeout=32s -O -`);
client.ssh.run(`wget --no-check-certificate https://${config['wire-server']}:6443/api/v1/namespaces/default/services/redis-ephemeral-headless -O -`);
client.ssh.run(`ssh -o "StrictHostKeyChecking=no" -o "BatchMode=yes" wire@${config['wire-server']} 'wget --no-check-certificate https://${config['wire-server']}:6443/version?timeout=32s -O -'`);
client.ssh.run(`ssh -o "StrictHostKeyChecking=no" -o "BatchMode=yes" wire@${config['wire-server']} 'wget --no-check-certificate https://localhost:6443/api/v1/namespaces/default/services/redis-ephemeral-headless -O -'`);
*/