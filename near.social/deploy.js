#!/usr/bin/env node

// TESTNET CONTRACT:
// const CONTRACT = 'v1.social08.testnet';
const CONTRACT = 'v1.social08.testnet';
const ACCOUNT = 'nearevents.testnet';

const SRC_DIR = 'widgets';

const { spawnSync } = require('child_process');
const { join } = require('path');
const { readdirSync, readFileSync } = require('fs');

function deployAll(dir) {
  const files = readdirSync(dir, { withFileTypes: true });

  files.forEach((file) => {
    const path = join(dir, file.name);

    if (file.isDirectory()) {
      return deployAll(path);
    }

    // skip unless isFile
    if (!file.isFile()) {
      return null;
    }

    // skip if not jsx file
    if (!path.endsWith('.jsx')) {
      return [];
    }

    deployFile(path);
    return true;
  });
}

function deployFile(path) {
  const widgetName = path
    .replace(`${__dirname}`, '')
    .replace(`/${SRC_DIR}/`, '')
    .replace('.jsx', '')
    .replace(/\//gu, '__');

  const nearArgs = {
    data: {
      [ACCOUNT]: {
        widget: {
          [widgetName]: {
            '': readFileSync(path, 'utf8'),
          },
        },
      },
    },
  };

  const args = [
    'call',
    CONTRACT,
    'set',
    '--deposit',
    '0.001',
    '--accountId',
    ACCOUNT,
    '--args',
    JSON.stringify(nearArgs),
  ];

  console.log(`Deploying ${widgetName}...`);

  const deploy = spawnSync('./node_modules/.bin/near', args, {
    cwd: __dirname,
  });

  if (deploy.status === 0) {
    console.log(`Deployed ${widgetName}`);
  } else {
    console.log(`Can not deploy ${widgetName}`);
    throw new Error('Can not deploy');
  }

  return true;
}

deployAll(join(__dirname, SRC_DIR));
// return false
