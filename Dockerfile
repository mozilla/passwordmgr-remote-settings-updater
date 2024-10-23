FROM node:14-slim

# add a non-privileged user for running the application
RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app

WORKDIR /app

# Install node requirements and clean up unneeded cache data
COPY package.json package.json
RUN npm install && \
    npm cache clear --force && \
    rm -rf ~app/.node-gyp

# Finally copy in the app's source file
COPY ./update-script.js /app
COPY ./app-constants.js /app
COPY ./version.json /app/version.json

USER app
