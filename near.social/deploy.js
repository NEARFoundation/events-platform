#!/usr/bin/env node

const { deployWidgetSync, SRC_DIR } = require('./shared');
const { join } = require('path');
const { readdirSync } = require('fs');

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

    deployWidgetSync(path, false);
    return true;
  });
}

deployAll(join(__dirname, SRC_DIR));
