const nodemon = require('nodemon');
const chokidar = require('chokidar');
const { spawnSync } = require('child_process');
const { readFileSync } = require('fs');

const CONTRACT = 'v1.social08.testnet';
const ACCOUNT = 'nearevents.testnet';

const SRC_DIR = 'widgets';

const obj = {};
obj.watch = [];
obj.watch.push('widgets');
obj.exec = 'echo "Watching for changes ..."';
obj.ext = 'jsx';
obj.delay = '2500';
obj.verbose = true;

// skip the first deploy
const didDeploy = {};

function deployWidget(path) {
  if (!didDeploy[path]) {
    didDeploy[path] = 1;
    return;
  }

  const widgetName = path
    .replace(`${__dirname}`, '')
    .replace(`${SRC_DIR}/`, '')
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
    // console.log(deploy.stdout.toString('utf8'));
  } else {
    console.log(`Can not deploy ${widgetName}`);
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
