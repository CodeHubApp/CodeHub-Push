FROM node:4.2.1
MAINTAINER Dillon Buchanan <thedillonb@gmail.com>

WORKDIR /app
COPY . /app

RUN npm install

CMD ["node", "--version"]
