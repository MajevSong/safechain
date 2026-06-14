# Chaincode-as-a-Service (CCAAS) image for the SafeChain chaincode.
# The peer connects to this server over gRPC; the peer never builds an image
# itself, which avoids the legacy docker-build path that breaks on Docker 29.
FROM node:20-alpine

ARG CC_SERVER_PORT=9999
WORKDIR /usr/src/app

# Install production deps first for better layer caching.
COPY package.json ./
RUN npm install --omit=dev

# Chaincode source.
COPY index.js ./
COPY lib ./lib

EXPOSE ${CC_SERVER_PORT}
CMD ["npm", "run", "start:server"]
