#!/usr/bin/env node

const { deployWidget, SRC_DIR } = require('./shared');

const nodemon = require('nodemon');
const chokidar = require('chokidar');

// setup chokidar and nodemon
const obj = {};
obj.watch = [];
obj.watch.push(SRC_DIR);
obj.exec = 'echo "Watching for changes ..."';
obj.ext = 'jsx';
obj.delay = '20';
obj.verbose = true;

chokidar.watch(obj.watch).on('all', (event, path) => {
  console.log(event, path);
  if (event === 'add' || event === 'change') {
    deployWidget(path);
  }
});

nodemon(obj);
