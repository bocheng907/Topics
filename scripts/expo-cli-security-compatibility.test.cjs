const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

// Exercise Expo's actual schemas, not a reimplementation of their validators.
const expoRequire = createRequire(require.resolve('expo/package.json'));
const cliRoot = path.dirname(expoRequire.resolve('@expo/cli/package.json'));
const cliRequire = createRequire(path.join(cliRoot, 'package.json'));
const server = name => require(path.join(cliRoot, 'build/src/start/server', name));
const { PluginSchema, DevToolsPluginOutputSchema } = server('DevToolsPlugin.schema.js');
const { createMCPDevToolsExtensionSchema } = server('createMCPDevToolsExtensionSchema.js');
const { DevToolsPluginCliExtensionResults } = server('DevToolsPluginCliExtensionResults.js');
const plugin = {
  packageName: 'local-compatibility-fixture',
  packageRoot: process.cwd(),
  cliExtensions: {
    description: 'Schema compatibility fixture', entryPoint: 'fixture.cjs',
    commands: [{ name: 'inspect', title: 'Inspect', environments: ['cli', 'mcp'], parameters: [
      { name: 'label', type: 'text' }, { name: 'count', type: 'number' }, { name: 'confirm', type: 'confirm' },
    ] }],
  },
};

test('Expo CLI resolves the patched Zod version', () => {
  assert.equal(cliRequire('zod/package.json').version, '4.6.7');
});

test('oversized constrained arrays fail before visiting attacker-controlled elements', () => {
  const { z } = cliRequire('zod');
  for (const constrain of [schema => schema.max(2), schema => schema.length(2)]) {
    let reads = 0;
    const oversized = Array.from({ length: 1000 }, () => ({
      get value() { reads++; return 1; },
    }));
    const schema = constrain(z.array(z.object({ value: z.string() })));
    const result = schema.safeParse(oversized);
    assert.equal(result.success, false);
    assert.equal(reads, 0);
    assert.equal(result.error.issues.length, 1);
    assert.equal(result.error.issues[0].code, 'too_big');
    const valid = [{ value: 'first' }, { value: 'second' }];
    assert.deepEqual(schema.parse(valid), valid);
    assert.equal(schema.safeParse([{ value: 1 }, { value: 'second' }]).success, false);
  }
});

test('plugin configuration accepts valid commands and preserves readonly environment arrays', () => {
  const value = PluginSchema.parse(plugin);
  assert.deepEqual(value, plugin);
  assert.ok(Object.isFrozen(value.cliExtensions.commands[0].environments));
});

test('plugin configuration rejects invalid command and parameter shapes', () => {
  for (const candidate of [null, {}, { ...plugin, packageName: '' }, {
    ...plugin, cliExtensions: { ...plugin.cliExtensions, commands: [] },
  }, { ...plugin, cliExtensions: { ...plugin.cliExtensions, commands: [{
    ...plugin.cliExtensions.commands[0], parameters: [{ name: 'bad', type: 'arbitrary' }],
  }] } }]) assert.equal(PluginSchema.safeParse(candidate).success, false);
});

test('MCP command schema accepts supported inputs and rejects unknown fields or wrong types', () => {
  const schema = createMCPDevToolsExtensionSchema(plugin);
  assert.deepEqual(schema.parse({ command: 'inspect', label: 'hello', count: 2, confirm: true }),
    { command: 'inspect', label: 'hello', count: 2, confirm: true });
  assert.equal(schema.safeParse({ command: 'inspect' }).success, true);
  for (const candidate of [{ command: 'unknown' }, { command: 'inspect', extra: 1 },
    { command: 'inspect', count: '2' }, { command: 'inspect', confirm: 'yes' }]) {
    assert.equal(schema.safeParse(candidate).success, false);
  }
});

test('plugin output validates text, audio and image messages', () => {
  const messages = [{ type: 'text', text: 'ready', level: 'info' },
    { type: 'audio', url: 'https://example.com/audio.wav' },
    { type: 'image', url: 'https://example.com/image.png', text: 'image' }];
  assert.deepEqual(DevToolsPluginOutputSchema.parse(messages), messages);
  assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'audio', url: 'invalid' }]).success, false);
});

test('CLI output error formatting still consumes Zod issues', () => {
  const results = new DevToolsPluginCliExtensionResults();
  const invalid = results.parseOutputText('[{"type":"unsupported"}]');
  assert.equal(invalid[0].level, 'error');
  assert.match(invalid[0].text, /^Invalid JSON:/);
  assert.deepEqual(results.parseOutputText('plain output'), [{ type: 'text', text: 'plain output', level: 'info' }]);
});
