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


// For each machine, do VM tasks 
for (let machine of[client]) {
    machine.vm.shut_off(); // Shut off the machine 
    machine.vm.delete_clone(); // Delete the current clone 
    machine.vm.create_clone(); // Create a new clone 
    machine.vm.start(); // Start the clone 
}

// Scan the network 
/*let scan = new Scanner(config);
for (let machine of scan.search(/wire-client/)) {
    config[machine.host] = machine.ip
}*/

// In case the host was already configured (repeat runs) and its hostname has now changed. This should at least throw a warning in case we did not intend a repeat run.
// Or used for fixed-IP setups to save the time of scanning
config['wire-server'] = "95.216.208.159";
config['wire-client'] = "192.168.1.121";

// We found each IP 
client.set_ip(config['wire-client']);
server.set_ip(config['wire-server']);

console.log(config);

// TODO: Create the wire user on the server, and ssh-copy-id and visudo

// Before anything else, set the date on both client and server (otherwise APT might break from waking up an out-of-date VM)
client.ssh.run(`sudo date --set="${new Date()}"`);
server.ssh.run(`sudo date --set="${new Date()}"`);

// Some debugging info on the client
client.ssh.run(`cat /proc/cpuinfo | grep processor | wc -l`);
client.ssh.run(`free -m && uptime`);

// Some debugging info on the server 
server.ssh.run(`cat /proc/cpuinfo | grep processor | wc -l`);
server.ssh.run(`free -m && uptime`);

// Basic setup and test
client.ssh.run("cd");
client.ssh.run("cat /etc/hostname");
client.ssh.run("pwd");

// Step: Prepare apt on client to make sure we do not try to use a previously broken apt
client.ssh.run("date");
client.ssh.run("uptime");
client.ssh.run("sudo apt update");
client.ssh.run("sudo dpkg --configure -a");
client.ssh.run("sudo apt install docker.io");
client.ssh.run("docker -v");

// Cleanup for convenience of repeated runs 
// TODO: Remove this, this is only for testing/coding
client.ssh.run("sudo rm -rf /home/wire/wire*");
client.ssh.run("ls -l /home/wire/");

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

// Step: Docker install 
client.ssh.run("sudo apt install docker.io");
client.ssh.run("docker -v");

// Step: Git
client.ssh.run('git clone --branch master https://github.com/wireapp/wire-server-deploy.git');
client.ssh.run("ls -l");
client.ssh.run("cd ~/wire-server-deploy");
client.ssh.run("pwd");
client.ssh.run("ls -l");
client.ssh.run("git submodule update --init --recursive");


// TODO: This step is not in the right place, it should not be here but at the end, or using a command inside the docker 
client.ssh.run("mkdir -p wire-server");
client.ssh.run("cd wire-server");
client.ssh.run("pwd");
client.ssh.run("curl -sSL https://raw.githubusercontent.com/wireapp/wire-server-deploy/master/values/wire-server/demo-secrets.example.yaml > secrets.yaml");
client.ssh.run("curl -sSL https://raw.githubusercontent.com/wireapp/wire-server-deploy/master/values/wire-server/demo-values.example.yaml > values.yaml");
client.ssh.run("openssl rand -base64 64 | env LC_CTYPE=C tr -dc a-zA-Z0-9 | head -c 42 > restund.txt");
client.ssh.run("sudo docker run --rm quay.io/wire/alpine-intermediate /dist/zauth -m gen-keypair -i 1 > zauth.txt");
client.ssh.run("ls -l");

// Extract the spar configuration 
client.ssh.run("curl -sSL https://raw.githubusercontent.com/wireapp/wire-server-deploy/master/values/wire-server/prod-values.example.yaml > prod-values.yaml");
client.ssh.run("grep 'spar:' prod-values.yaml -A 24 > spar.yaml");
client.ssh.run("sed -i 's/cassandra-external/cassandra-ephemeral/' spar.yaml");
//  config:
//    cassandra:
//      host: cassandra-ephemeral

client.ssh.run("ls -l");

// Parse the output
let restund = client.ssh.run("cat restund.txt && echo").trim().split('\n')[1];
let zauth = client.ssh.run("cat zauth.txt").trim().split('\n');
zauth.shift();
zauth[1] = zauth[1] + (zauth[2] || '');
zauth = {
    public: zauth[0].split(': ')[1],
    secret: zauth[1].split(': ')[1]
};

// Actually substitute 
client.ssh.run(`sed -i 's/secret:$/secret: ${restund}/' secrets.yaml`);
client.ssh.run(`sed -i 's/publicKeys: "<public key>"/publicKeys: "${zauth.public}"/' secrets.yaml`);
client.ssh.run(`sed -i 's/privateKeys: "<private key>"/privateKeys: "${zauth.secret}"/' secrets.yaml`);
client.ssh.run(`cat secrets.yaml | grep '${restund}'`);
client.ssh.run(`cat secrets.yaml | grep '${zauth.public}'`);
client.ssh.run(`cat secrets.yaml | grep '${zauth.secret}'`);

// Set spar to true to fix 502 bug according to Arian's instructions  
// TODO: PR 
client.ssh.run(`cat values.yaml | grep spar`);
client.ssh.run(`sed -i 's/spar: false/spar: true/' values.yaml`);
client.ssh.run("cat spar.yaml >> values.yaml");
client.ssh.run(`cat values.yaml | grep spar`);

// Configure SMTP

client.ssh.run(`grep demo-smtp values.yaml -A 3`);
client.ssh.run(`echo 'XwsqNKEnxJf9vxX' > /tmp/smtp-password.txt`);
client.ssh.run(`sed -i 's/host: demo-smtp/host: smtp.gmail.com/' values.yaml`);
client.ssh.run(`sed -i 's/port: 25/port: 587/' values.yaml`);
client.ssh.run(`sed -i 's/connType: plain/connType: tls/' values.yaml`);
client.ssh.run(`sed -i 's/plain|ssl|tls/plain|ssl|tls\\n      username: arthur.wolf@wire.com\\n      passwordFile: \\/tmp\\/smtp-password.txt\\n/' values.yaml`);
client.ssh.run(`grep smtp.gmail.com values.yaml -A 5`);

//    smtp:
//      host: smtp.gmail.com # change this if you want to use your own SMTP server
//      port: 587        # change this
//      connType: tls # change this. Possible values: plain|ssl|tls
//      username: xxxxx@gmail.com
//      passwordFile: /etc/wire/brig/secrets/smtp-password.txt

// example config:
//    smtp:
//      host: demo-smtp # change this if you want to use your own SMTP server
//      port: 25        # change this
//      connType: plain # change this. Possible values: plain|ssl|tls


//process.exit(0);


// TODO: Clean up for this step 
client.ssh.run("cd ~/wire-server-deploy");
client.ssh.run("pwd");
client.ssh.run("ls -l");

// Step: Install nix 
client.ssh.run(`curl -L https://nixos.org/nix/install | sh`);
client.ssh.run(`. /home/wire/.nix-profile/etc/profile.d/nix.sh`);

// Step: Install direnv
client.ssh.run(`sudo apt install direnv`);
client.ssh.run(`eval "$(direnv hook bash)"`);
client.ssh.run(`direnv allow`);
client.ssh.run("ansible --version");

// Step: Inside the docker
client.ssh.run("cd ansible");
client.ssh.run("pwd");
client.ssh.run("cp inventory/demo/hosts.example.ini inventory/demo/hosts.ini");
client.ssh.run("ls -l inventory/demo/hosts.ini");
client.ssh.run(`sed -i 's/X.X.X.X/${config['wire-server']}/g' inventory/demo/hosts.ini`);
client.ssh.run(`cat inventory/demo/hosts.ini | grep ansible_host`);

// Step: Set up passwordless sudo on the server, client-side part
client.ssh.run("ssh-keygen -f ~/.ssh/id_rsa -t rsa -P ''");
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

client.ssh.run(`ls -l`);
client.ssh.run(`pwd`);

client.ssh.run(`cd ~/wire-server-deploy`);
client.ssh.run(`ls -l`);
client.ssh.run(`pwd`);

client.ssh.run(`cd wire-server/`);
client.ssh.run(`ls -l`);
client.ssh.run(`pwd`);

client.ssh.run(`helm upgrade --install wire-server wire/wire-server -f values.yaml -f secrets.yaml --wait --debug`);

// Do the helm install for nginx ingress 
client.ssh.run(`cd ~/wire-server-deploy`);
client.ssh.run(`ls -l`);
client.ssh.run(`pwd`);

client.ssh.run(`mkdir -p nginx-ingress-services`);
client.ssh.run(`cd nginx-ingress-services`);
client.ssh.run(`cp ../values/nginx-ingress-services/demo-secrets.example.yaml secrets.yaml`);
client.ssh.run(`cp ../values/nginx-ingress-services/demo-values.example.yaml values.yaml`);

client.ssh.run(`helm upgrade --install nginx-ingress-controller wire/nginx-ingress-controller --wait`);
client.ssh.run(`helm upgrade --install nginx-ingress-services wire/nginx-ingress-services -f values.yaml -f secrets.yaml --wait`);

// Open the ports to the public 
server.ssh.run(`sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 31773`);
server.ssh.run(`sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 31772`);


process.exit(0);

/*

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

client.ssh.run("curl -sSL https://raw.githubusercontent.com/wireapp/wire-server-deploy/master/values/wire-server/demo-secrets.example.yaml > secrets.yaml");
client.ssh.run("curl -sSL https://raw.githubusercontent.com/wireapp/wire-server-deploy/master/values/wire-server/demo-values.example.yaml > values.yaml");
client.ssh.run("openssl rand -base64 64 | env LC_CTYPE=C tr -dc a-zA-Z0-9 | head -c 42 > restund.txt");
client.ssh.run("sudo docker run --rm quay.io/wire/alpine-intermediate /dist/zauth -m gen-keypair -i 1 > zauth.txt");
client.ssh.run("ls -l");

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
client.ssh.run(`sed -i 's/secret:$/secret: ${restund}/' secrets.yaml`);
client.ssh.run(`sed -i 's/publicKeys: "<public key>"/publicKeys: "${zauth.public}"/' secrets.yaml`);
client.ssh.run(`sed -i 's/privateKeys: "<private key>"/privateKeys: "${zauth.secret}"/' secrets.yaml`);
client.ssh.run(`cat secrets.yaml | grep '${restund}'`);
client.ssh.run(`cat secrets.yaml | grep '${zauth.public}'`);
client.ssh.run(`cat secrets.yaml | grep '${zauth.secret}'`);


*/