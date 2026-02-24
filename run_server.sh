#!/bin/sh
cd /volume1/homes/fo/projects/nodejs/heatpump_sniffer
#node --trace-warnings --inspect=0.0.0.0:9229 ./src/server/main.js
export FOREVER_ROOT=/var/services/homes/fo/.forever
./node_modules/forever/bin/forever start ./src/server/main.js 
