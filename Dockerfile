FROM node:6.5.0
MAINTAINER Dillon Buchanan <thedillonb@gmail.com>

WORKDIR /app
COPY . /app

RUN npm install

CMD ["node", "--version"]
