// Run the existing export suite on the dedicated reliability emulator without
// touching the original suite or the historical emulator on port 18198.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18298' ||
    process.env.GCLOUD_PROJECT !== 'demo-care-walkthrough') throw Error('Dedicated emulator required');
const filename = path.join(__dirname, 'personal-data-export.test.cjs');
const source = fs.readFileSync(filename, 'utf8');
if (!source.includes('127.0.0.1:18198') || !source.includes('demo-invite-expiry')) {
  throw Error('Review the original test guard before adapting it');
}
const isolated = source.replaceAll('127.0.0.1:18198', '127.0.0.1:18298')
  .replaceAll('demo-invite-expiry', 'demo-care-walkthrough');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(__dirname);
loaded._compile(isolated, filename);
