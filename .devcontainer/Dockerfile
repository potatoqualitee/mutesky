FROM node:22.12.0

# Install git and build essentials
RUN apt-get update && apt-get install -y git build-essential

# Install webpack globally
RUN npm install -g webpack webpack-cli

WORKDIR /workspace

# Set npm to allow global installs without sudo
RUN mkdir ~/.npm-global && \
    npm config set prefix '~/.npm-global' && \
    echo "export PATH=~/.npm-global/bin:$PATH" >> ~/.bashrc

EXPOSE 443