#!/usr/bin/env node

const { deployWidget, SRC_DIR } = require('./shared');

const chokidar = require('chokidar');
chokidar.watch([SRC_DIR]).on('all', (event, path) => {
  console.log(event, path);
  if (event === 'add' || event === 'change') {
    deployWidget(path);
  }
});

process.once('SIGUSR2', () => {
  process.kill(process.pid, 'SIGUSR2');
});

process.once('SIGINT', () => {
  process.kill(process.pid, 'SIGINT');
});

process.once('SIGTERM', () => {
  process.kill(process.pid, 'SIGTERM');
});
