const sh = require('shelljs');

// Shells should be silent 
sh.config.silent = true;

// Remote access(via ssh and tmux) on a machine to execute commands
module.exports = class Remote {

    constructor(options) {
        this.options = options;
        this.logger = options.logger;

        // Automatic answers 
        this.answers = [
            [/Do you want to continue/gi, "y Enter"],
            [/(sudo.*password for wire|wire@.*s password)/gi, "changeme Enter"], // TODO: Make this a configuration option
            [/^Please type .* or the fingerprint/gi, "yes Enter"],
            [/^Overwrite \(y\/n\)\?/gi, "y Enter"],
            [/^Are you sure you want to continue connecting/gi, "yes Enter"]
        ];
    }

    // Use SSH on the target (private)
    ssh(command) {
        const to_run = `ssh -o "StrictHostKeyChecking=no" -o "BatchMode=yes" ${this.options.user}@${this.options.ip} ${command} `;
        //console.log(to_run);
        let result = sh.exec(to_run);
        //console.log(result.stdout);
        //console.log(result.stderr);
        return result;
    }

    // Remotely run a command
    run(command) {

        //console.log(command);

        // Open the session. If we hear about tmux being missing, we need to install it.
        // TODO: If the download fails, scp a local copy
        let error = this.ssh(`/tmp/tmux new -d -s install`).stderr;
        if (/tmux.+No such file or directory/gi.test(error)) {
            this.logger.log(`# Initial install of tmux on ${this.options.ip}`); // TODO: Replace tmux with remote control of the actual virtual machine
            this.ssh(`wget https://github.com/nelsonenzo/tmux-appimage/releases/download/tmux3.1b/tmux-3.1b-x86_64.AppImage -O /tmp/tmux `);
            this.ssh(`chmod +x /tmp/tmux `);
            this.ssh(`/tmp/tmux new -d -s install`);
        }

        // Clear previous output
        this.ssh(`/tmp/tmux send-keys -t install "clear Enter"`);
        this.ssh(`/tmp/tmux clear-history -t install`);

        // Send the actual command 
        this.ssh(`/tmp/tmux send-keys -t install -l -H ${command.split('').map(x => x.charCodeAt(0).toString(16)).join(' ')} 0A`);

        // Wait for an answer we recognize as the command being fully executed 
        while (1) {
            this.ssh(`/tmp/tmux capture-pane -t install -b capture`);
            let result = this.ssh(`/tmp/tmux show-buffer -b capture`).stdout.trim();
            let lastline = result.split("\n").pop();
            for (let answer of this.answers) { if (answer[0].test(lastline)) { this.ssh(`/tmp/tmux send-keys -t install "${answer[1]}"`) } }

            // If we recognize the command prompt
            if (/^((root|wire)@(wire-(client|server)|kubenode01|arthur-demo|arthur1|arthur2)|bash-[\d\.-]*\#)/gi.test(lastline) && result.split("\n").length > 1) {

                // Capture the output/history for this command, and return it
                this.ssh(`/tmp/tmux capture-pane -S -3000 -t install -b capture`);
                let result = this.ssh(`/tmp/tmux show-buffer -b capture`).stdout.trim();
                let lines = result.split("\n");
                lines.pop();
                this.logger.log(`# Running command «${command}» on ${this.options.ip}\n        ${lines.join("\n        ")}`);
                return lines.join("\n");
            }

            // Otherwise, wait a bit 
            sh.exec("sleep 0.2");
        }
    }

}
