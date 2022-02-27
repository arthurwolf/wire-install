const fs   = require('fs');
const YAML = require('yaml');

// Parse a documentation page for commands to execute
module.exports = class Docs {

    constructor(file) {
        // Save the file name
        this.file = file;

        // Store tests
        this.tests = [];

        // Parse the file
        this.parse(file);
    }

    parse(file){

        // TODO: This is only for debugging purposes, to keep our work in wire-docs up to date with our work here. 
        // Later on we should be automatically getting this from Github each time, but currently we can't as none of the work is on Github at this point.
        fs.writeFileSync(`docs/${file}`, fs.readFileSync(`/home/arthur/dev/wire/wire-docs/src/how-to/install/${file}`));

        // Get content
        let content = fs.readFileSync(`docs/${file}`).toString().split("\n");
        
        // For each line
        while(content.length){
            let line = content.shift();

            // Check if the line mathes the test-step format
            if(/\.\.\s*test-step/.test(line)){

                // Parse the YAML
                let config = YAML.parse(line.split("test-step")[1]);

                // Remember in the config which file this came from
                config.file = this.file;
 
                // If we need to, get the commands from the next code block
                if(config.commands == 'from-next-code-block'){
                    // Used to store the commands
                    config.commands = [];

                    // Scan until we get to the next code block
                    while(content.length){
                        let candidate = content.shift();

                        // Check if the line matches the code-block format ( « .. code:: shell » )
                        if(/\.\.\s*code\:\:/.test(candidate)){

                            // Scan until we have all the commands
                            while(content.length){
                                let possible = content.shift();

                                // Skip lines that contain nothing yet
                                if(possible == '') continue;
                                if(/^\s*$/.test(possible)) continue;

                                // Save lines that contain a command
                                if(/^\s+/.test(possible)){
                                    config.commands.push(possible.replace(/^\s*/i, ''));
                                    continue;
                                }

                                // If we got here without "continue"ing, we are out of data/commands, and must be done
                                break;
                            }

                            // Exit the loop
                            break;
                        }
                    }
                }else{
                    config.commands = config.commands;
                }

                // Handle the special case in which commands are multi-line
                config.commands = config.commands.join("\n").replace(/\\\n/gi, '').split("\n");

                // Save test config for future use
                this.tests.push(config);

            }
            
        }

    }


};