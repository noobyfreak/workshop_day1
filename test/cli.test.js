'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { browserCommand, main } = require('../cli.js');

function response(status, body, headers = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

function capture() {
  const out = [];
  const err = [];
  return { out, err, stdout: (value) => out.push(value), stderr: (value) => err.push(value) };
}

test('help prints usage without contacting the API', async () => {
  const output = capture();
  const code = await main(['help'], {
    ...output,
    fetchImpl: () => assert.fail('help should not fetch'),
  });
  assert.equal(code, 0);
  assert.match(output.out[0], /snip add <url>/);
  assert.deepEqual(output.err, []);
});

test('add validates URLs before POST and prints the returned shortUrl', async () => {
  const output = capture();
  let request;
  const code = await main(['add', 'https://example.com/a'], {
    ...output,
    apiUrl: 'http://localhost:3456/',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response(201, {
        code: 'a1B2c3',
        url: 'https://example.com/a',
        shortUrl: 'http://localhost:3456/a1B2c3',
        hits: 0,
        createdAt: new Date().toISOString(),
      });
    },
  });
  assert.equal(code, 0);
  assert.equal(request.url, 'http://localhost:3456/api/links');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { url: 'https://example.com/a' });
  assert.deepEqual(output.out, ['http://localhost:3456/a1B2c3']);

  let fetched = false;
  const invalid = await main(['add', 'javascript:alert(1)'], {
    ...capture(),
    fetchImpl: () => { fetched = true; },
  });
  assert.equal(invalid, 1);
  assert.equal(fetched, false);
});

test('ls prints the empty-state message and an aligned links table', async () => {
  const empty = capture();
  assert.equal(await main(['ls'], { ...empty, fetchImpl: async () => response(200, []) }), 0);
  assert.deepEqual(empty.out, ['No links yet.']);

  const populated = capture();
  const links = [
    { code: 'abc123', url: 'https://example.com', hits: 4 },
    { code: 'xy', url: 'https://example.org', hits: 0 },
  ];
  assert.equal(await main(['ls'], {
    ...populated,
    fetchImpl: async () => response(200, links),
  }), 0);
  assert.match(populated.out[0], /CODE\s+HITS\s+URL/);
  assert.match(populated.out[0], /abc123\s+4\s+https:\/\/example.com/);
  assert.match(populated.out[0], /xy\s+0\s+https:\/\/example.org/);
});

test('open inspects the redirect manually and launches its Location target', async () => {
  const output = capture();
  let request;
  let opened;
  const code = await main(['open', 'a1B2c3'], {
    ...output,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response(302, undefined, { location: 'https://example.com/original' });
    },
    launchBrowser: async (url, platform) => { opened = { url, platform }; },
    platform: 'linux',
  });
  assert.equal(code, 0);
  assert.equal(request.url, 'http://localhost:3000/a1B2c3');
  assert.equal(request.options.redirect, 'manual');
  assert.deepEqual(opened, { url: 'https://example.com/original', platform: 'linux' });
  assert.deepEqual(output.out, ['Opened https://example.com/original']);

  const missing = capture();
  assert.equal(await main(['open', 'missing'], {
    ...missing,
    fetchImpl: async () => response(404, { error: 'Not found' }),
  }), 1);
  assert.match(missing.err[0], /No link found for code "missing"/);
});

test('API and network failures return exit code 1 and write to stderr', async () => {
  const apiFailure = capture();
  assert.equal(await main(['ls'], {
    ...apiFailure,
    fetchImpl: async () => response(500, { error: 'broken' }),
  }), 1);
  assert.match(apiFailure.err[0], /HTTP 500\): broken/);
  assert.deepEqual(apiFailure.out, []);

  const networkFailure = capture();
  assert.equal(await main(['ls'], {
    ...networkFailure,
    fetchImpl: async () => { throw new Error('offline'); },
  }), 1);
  assert.match(networkFailure.err[0], /Could not reach the Snip API: offline/);
});

test('browser launch command is selected for each supported platform', () => {
  assert.deepEqual(browserCommand('darwin', 'https://example.com'), ['open', ['https://example.com']]);
  assert.deepEqual(browserCommand('linux', 'https://example.com'), ['xdg-open', ['https://example.com']]);
  assert.equal(browserCommand('win32', 'https://example.com')[0], 'cmd.exe');
  assert.throws(() => browserCommand('plan9', 'https://example.com'), /not supported/);
});
