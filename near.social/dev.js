const PATH_TO_NEAR_CLI = './node_modules/.bin/near';
const SOCIAL_CONTRACT = 'v1.social08.testnet';
const ACCOUNT_ON_SOCIAL = 'nearevents.testnet';
const ENV_FILE_PATH = '.env';
const SRC_DIR = 'widgets';

/// /////////////////////////// DO NOT EDIT BELOW THIS LINE /////////////////////////////

const nodemon = require('nodemon');
const chokidar = require('chokidar');
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
  const parts = path.split('/');

  for (let i = parts.length - 1; i >= 0; i--) {
    const tryPath = parts.slice(0, i).join('/') + `/${ENV_FILE_PATH}`;
    if (existsSync(tryPath)) {
      envPath = tryPath;
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
// TODO: add support for `{{ env.KEY | 'default value' }}`
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
  if (!didDeploy[path]) {
    didDeploy[path] = 1;
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

chokidar.watch(obj.watch).on('all', (event, path) => {
  console.log(event, path);
  if (event === 'add' || event === 'change') {
    deployWidget(path);
  }
});

nodemon(obj);
