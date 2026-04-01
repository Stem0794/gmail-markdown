const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  use: {
    browserName: 'chromium',
    headless: true,
  },
});
