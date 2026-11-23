const assert = require('node:assert/strict');
const request = require('request');
const { afterEach, mock, test } = require('node:test');
const { AtlasAPI } = require('../../dist/modules/atlas-api.js');

afterEach(() => {
  mock.restoreAll();
  AtlasAPI.instance = undefined;
  AtlasAPI.bearerToken = undefined;
});

test('requires a bearer token and maps public registry results', async () => {
  assert.throws(() => AtlasAPI.getInstance(), /Bearer token/);
  AtlasAPI.setBearerToken('fixture-token');
  const api = AtlasAPI.getInstance();
  assert.equal(AtlasAPI.getInstance(), api);
  mock.method(request, 'get', (url, options, done) => {
    assert.match(url, /\/api\/v1\/search$/);
    assert.equal(options.auth.bearer, 'fixture-token');
    done(null, { statusCode: 200 }, JSON.stringify({ boxes: [
      {
        tag: 'tester/box', name: 'box', username: 'tester', description_html: null,
        short_description: 'Short description',
        current_version: { version: '2.0', providers: [{ name: 'virtualbox' }] },
      },
      {
        tag: 'tester/other', name: 'other', username: 'tester', description_html: '<p>Long</p>',
        current_version: { version: '1.0', providers: [] },
      },
    ] }));
  });
  const result = await api.search().toPromise();
  assert.deepEqual(result[0], {
    tag: 'tester/box', name: 'box', username: 'tester', description: 'Short description',
    version: '2.0', providers: ['virtualbox'],
  });
  assert.equal(result[1].description, '<p>Long</p>');
});

test('completes with no boxes for network, HTTP and invalid JSON responses', async () => {
  const api = AtlasAPI.getInstance('explicit-fixture-token');
  for (const reply of [
    [new Error('offline'), undefined, undefined],
    [null, undefined, undefined],
    [null, { statusCode: 199 }, '{}'],
    [null, { statusCode: 503 }, 'unavailable'],
    [null, { statusCode: 200 }, 'invalid JSON'],
  ]) {
    const get = mock.method(request, 'get', (_url, _options, done) => done(...reply));
    assert.equal(await api.search().toPromise(), null);
    get.mock.restore();
  }
});
