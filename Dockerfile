FROM node:5.8.0
MAINTAINER Dillon Buchanan <thedillonb@gmail.com>

WORKDIR /app
COPY . /app

RUN npm install

CMD ["node", "--version"]
