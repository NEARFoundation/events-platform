#!/usr/bin/env node
const { parsed } = require('dotenv').config({ path: './.env' });

const PATH_TO_NEAR_CLI = parsed.PATH_TO_NEAR_CLI;
const SOCIAL_CONTRACT = parsed.SOCIAL_CONTRACT;
const ACCOUNT_ON_SOCIAL = parsed.ACCOUNT_ON_SOCIAL;
const ENV_FILE_PATH = parsed.ENV_FILE_PATH;
const SRC_DIR = parsed.SRC_DIR;

/// /////////////////////////// DO NOT EDIT BELOW THIS LINE /////////////////////////////

const EXT_JSX = '.jsx';

const { spawnSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');

// setup chokidar and nodemon
const obj = {};
obj.watch = [];
obj.watch.push(SRC_DIR);
obj.exec = 'echo "Watching for changes ..."';
obj.ext = 'jsx';
obj.delay = '20';
obj.verbose = true;

// skip the first deploy
const didDeploy = {};

// traverse path upwards, up to SRC_DIR, looking for .env file
// returns env object
function fetchEnv(path) {
  let envPath = null;
  const parts = (path.replace(EXT_JSX, '') + '/')
    .replace(`${__dirname}/`, '')
    .replace(`${SRC_DIR}/`, '')
    .split('/');

  // tries to find .env file in parent directories
  // for file `file.jsx` will match: .env and file/.env and file.env
  for (let i = 0; i < parts.length; i += 1) {
    const tryPathDir =
      [SRC_DIR, ...parts.slice(0, i)].join('/') + `/${ENV_FILE_PATH}`;
    if (existsSync(tryPathDir)) {
      envPath = tryPathDir;
    }
    const tryPathFile =
      [SRC_DIR, ...parts.slice(0, i)].join('/') + `${ENV_FILE_PATH}`;
    if (existsSync(tryPathFile)) {
      envPath = tryPathFile;
    }
  }

  // TODO: merge env from local file
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

// loads file contents and replaces `{{ env.KEY }}` with env.KEY value
// TODO: minify fileContent before deploying to save gas and storage
function loadFileAsTemplate(env, path) {
  const content = readFileSync(path, 'utf8');
  return Object.entries(env).reduce((acc, [key, value]) => {
    const regexString = `\\{\\{\\s+env\\.${key}\\s+\\}\\}`;
    return acc.replace(new RegExp(regexString, 'gu'), value);
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
            // metadata: {
            //   title: 'My widget',
            //   description: 'My widget description',
            // },
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
    .replace(EXT_JSX, '')
    .replace(/^\//u, '')
    .replace(/\//gu, '__');
}

// deploys widget to social contract
function deployWidget(path, skipFirstDeploy = true) {
  if (skipFirstDeploy && !didDeploy[path]) {
    didDeploy[path] = 1;
    return;
  }

  if (!path.endsWith(EXT_JSX)) {
    return;
  }

  const widgetName = buildWidgetName(path);
  const env = fetchEnv(path);

  const fileContent = loadFileAsTemplate(env, path);
  const contractArgs = buildContractArgs(widgetName, fileContent);

  // TODO: determine if we need to deploy or not by comparing fileContent with current state of contract
  // NOTE: we must also check updated metadata, but maybe can do this in a separate call

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

module.exports = {
  PATH_TO_NEAR_CLI,
  SOCIAL_CONTRACT,
  ACCOUNT_ON_SOCIAL,
  ENV_FILE_PATH,
  SRC_DIR,
  EXT_JSX,

  deployWidget,
};
