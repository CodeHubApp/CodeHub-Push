FROM node:9
LABEL maintainer="thedillonb@gmail.com"

WORKDIR /app
COPY . /app

RUN npm install

CMD ["node", "--version"]
