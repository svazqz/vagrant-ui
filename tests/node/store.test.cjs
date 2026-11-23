const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mock, test } = require('node:test');

test('keeps pending settings in memory and persists explicitly saved settings', context => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vigger-settings-'));
  context.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const electronPath = require.resolve('electron');
  assert.equal(require.cache[electronPath], undefined);
  require.cache[electronPath] = {
    exports: { app: { getPath: mock.fn(() => directory) } },
  };
  context.after(() => delete require.cache[electronPath]);
  const { Store } = require('../../dist/modules/store.js');

  const options = { configName: 'test', defaults: { theme: 'light' } };
  const store = new Store(options);
  assert.equal(store.get('theme'), 'light');
  store.set('theme', 'dark');
  assert.equal(store.get('theme'), 'dark');
  assert.equal(new Store(options).get('theme'), 'light');
  store.commit();
  assert.equal(new Store(options).get('theme'), 'dark');
  store.set('theme', 'system', true);
  assert.equal(new Store(options).get('theme'), 'system');

  const filename = path.join(directory, 'test.json');
  for (const malformed of ['null', '[]', '42', '{']) {
    fs.writeFileSync(filename, malformed);
    assert.equal(new Store(options).get('theme'), 'light');
  }
  assert.equal(new Store({ configName: 'uninitialized' }).get('missing'), undefined);
});
