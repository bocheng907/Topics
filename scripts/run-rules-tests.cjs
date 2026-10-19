// Runs tests/rules/*.test.mjs against the local Firestore + Storage emulators.
// Uses the demo-rules-test project (demo-* never touches a real project).
// firebase-tools 15 requires Java 21+ (the default JDK on PATH). Set
// RULES_TEST_JAVA_HOME to use a different JDK for the emulators.
// The emulator JVM heap is kept small by default (machines with little free
// memory); override with JAVA_TOOL_OPTIONS.
const {spawnSync} = require('node:child_process');
const path = require('node:path');

const env = {...process.env};
if (env.RULES_TEST_JAVA_HOME) {
  env.JAVA_HOME = env.RULES_TEST_JAVA_HOME;
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = path.join(env.JAVA_HOME, 'bin') + path.delimiter + (env[pathKey] || '');
}
if (!env.JAVA_TOOL_OPTIONS) env.JAVA_TOOL_OPTIONS = '-XX:+UseSerialGC -Xms16m -Xmx384m';

const testCommand = 'node --test --test-concurrency=1 "tests/rules/*.test.mjs"';
const result = spawnSync('firebase', [
  'emulators:exec', '--config', 'firebase.rules-test.json', '--only', 'firestore,storage',
  '--project', 'demo-rules-test', JSON.stringify(testCommand),
], {cwd: path.join(__dirname, '..'), env, stdio: 'inherit', shell: true});

process.exit(result.status === null ? 1 : result.status);
