#!/usr/bin/env node

const PATH_TO_NEAR_CLI = './node_modules/.bin/near';
// const SOCIAL_CONTRACT = 'v1.social08.testnet';
// const ACCOUNT_ON_SOCIAL = 'nearevents.testnet';
const SOCIAL_CONTRACT = 'social.near';
const ACCOUNT_ON_SOCIAL = 'events_v1.near';
const ENV_FILE_PATH = '.env';
const SRC_DIR = 'widgets';

// ///////////////////////////// DO NOT EDIT BELOW THIS LINE /////////////////////////////

const { join } = require('path');
const { spawnSync } = require('child_process');
const { readFileSync, existsSync, readdirSync } = require('fs');

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

    deployWidget(path);
    return true;
  });
}

// traverse path upwards, up to SRC_DIR, looking for .env file
// returns env object
function fetchEnv(path) {
  let envPath = null;
  const parts = path.split('/');

  for (let i = parts.length - 1; i >= 0; i--) {
    const tryPath = parts.slice(0, i).join('/') + `/${ENV_FILE_PATH}`;
    if (existsSync(tryPath)) {
      envPath = tryPath;
    }
  }

  if (!envPath) {
    return {};
  }

  const content = readFileSync(envPath, 'utf8');
  const env = content.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    acc[key] = value;
    return acc;
  }, {});

  return env;
}

// replaces `{{ env.KEY }}` with env.KEY value
function loadFileAsTemplate(env, path) {
  const content = readFileSync(path, 'utf8');
  return Object.entries(env).reduce((acc, [key, value]) => {
    const regexString = `\\{\\{\\s*env\\.${key}\\s*\\}\\}`;
    const regex = new RegExp(regexString, 'gu');
    return acc.replace(regex, value);
  }, content);
}

// builds contract args for set method of contract
function buildContractArgs(widgetName, fileContent) {
  return {
    data: {
      [ACCOUNT_ON_SOCIAL]: {
        widget: {
          [widgetName]: {
            '': fileContent,
            // TODO: metadata from env?
          },
        },
      },
    },
  };
}

function buildWidgetName(path) {
  return path
    .replace(`${__dirname}`, '')
    .replace(`${SRC_DIR}/`, '')
    .replace('.jsx', '')
    .replace(/^\//u, '')
    .replace(/\//gu, '__');
}

// deploys widget to social contract
function deployWidget(path) {
  const widgetName = buildWidgetName(path);
  const env = fetchEnv(path);

  const fileContent = loadFileAsTemplate(env, path);
  const contractArgs = buildContractArgs(widgetName, fileContent);

  const args = [
    'call',
    SOCIAL_CONTRACT,
    'set',
    '--deposit',
    '0.001',
    '--accountId',
    ACCOUNT_ON_SOCIAL,
    '--args',
    JSON.stringify(contractArgs, null, 4),
  ];

  const timeInMillis = new Date().getTime();
  console.log(`  |> Deploying ${widgetName}...`);

  const deploy = spawnSync(PATH_TO_NEAR_CLI, args, {
    cwd: __dirname,
  });

  if (deploy.status === 0) {
    console.log(
      `  |> Successfully deployed ${widgetName} in ${
        new Date().getTime() - timeInMillis
      }`
    );
    // console.log(deploy.stdout.toString('utf8'));
  } else {
    console.log(`  |> Can not deploy ${widgetName}`);
    throw new Error('Can not deploy');
  }
}

deployAll(join(__dirname, SRC_DIR));
// return false
