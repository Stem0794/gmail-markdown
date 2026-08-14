'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = require(path.join(projectRoot, 'package.json'));
const expectedVersion = packageJson.devDependencies.marked;
const markedPackageJson = require.resolve('marked/package.json');
const markedRoot = path.dirname(markedPackageJson);
const source = path.join(markedRoot, 'lib', 'marked.umd.js');
const targetDir = path.join(projectRoot, 'vendor');
const target = path.join(targetDir, 'marked.umd.js');

const contents = fs.readFileSync(source, 'utf8');
if (!contents.includes(`marked v${expectedVersion} - a markdown parser`)) {
  throw new Error(`Expected Marked ${expectedVersion}; refusing to vendor an unexpected build`);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(target, contents);
console.log(`Vendored Marked ${expectedVersion} -> vendor/marked.umd.js`);
