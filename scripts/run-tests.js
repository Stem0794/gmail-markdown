'use strict';

const fs = require('fs');
const path = require('path');
const Mocha = require('mocha');

const testDir = path.resolve(__dirname, '../test');
const testFiles = fs.readdirSync(testDir)
  .filter(file => file.endsWith('.test.js'))
  .sort()
  .map(file => path.join(testDir, file));

const mocha = new Mocha();
testFiles.forEach(file => mocha.addFile(file));
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
});
