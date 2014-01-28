#!/bin/bash

forever start endpoint/index.js
forever start push/index.js

stopAll() {
    forever stop endpoint/index.js
    forever stop push/index.js
    exit
}

trap stopAll SIGINT SIGTERM

while true
do
    node ./work/index.js
    sleep 60
done