# Start from the node image
FROM node:16

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Install node dependencies
RUN npm install

# Bundle app source
COPY . .

# Actually run 
CMD [ "node", "docker-path.js" ]
