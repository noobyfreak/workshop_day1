#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');

const DEFAULT_API_URL = 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 10000;
const USAGE = `Usage:
  snip add <url>    Create a short link
  snip ls           List all links
  snip open <code>  Open a short link in your browser
  snip help         Show this help

Set SNIP_API to use a backend other than ${DEFAULT_API_URL}.`;

function normalizeApiBase(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('SNIP_API must use http or https.');
  }
  return parsed.origin;
}

function validateHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Enter a valid http or https URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('Enter a valid http or https URL.');
  }
  return parsed.href;
}

async function requestApi(apiBase, path, options = {}, fetchImpl = fetch) {
  try {
    return await fetchImpl(`${apiBase}${path}`, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error.name === 'TimeoutError' || error.name === 'AbortError'
      ? 'request timed out'
      : error.message;
    throw new Error(`Could not reach the Snip API: ${reason}`);
  }
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error(`The Snip API returned invalid JSON (HTTP ${response.status}).`);
  }
}

async function apiError(response) {
  let detail = '';
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') detail = `: ${body.error}`;
  } catch {
    // Keep the HTTP status useful when the server does not return JSON.
  }
  return new Error(`Snip API request failed (HTTP ${response.status})${detail}`);
}

function formatLinks(links) {
  if (links.length === 0) return 'No links yet.';

  const codeWidth = Math.max(4, ...links.map((link) => String(link.code).length));
  const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits).length));
  const rows = [
    `${'CODE'.padEnd(codeWidth)}  ${'HITS'.padStart(hitsWidth)}  URL`,
    `${'-'.repeat(codeWidth)}  ${'-'.repeat(hitsWidth)}  ---`,
    ...links.map((link) =>
      `${String(link.code).padEnd(codeWidth)}  ${String(link.hits).padStart(hitsWidth)}  ${link.url}`),
  ];
  return rows.join('\n');
}

function browserCommand(platform, target) {
  if (platform === 'darwin') return ['open', [target]];
  if (platform === 'win32') {
    return ['cmd.exe', ['/d', '/s', '/c', `start "" "${target}"`]];
  }
  if (platform === 'linux') return ['xdg-open', [target]];
  throw new Error(`Opening links is not supported on ${platform}.`);
}

function launchBrowser(target, platform = process.platform) {
  const [command, args] = browserCommand(platform, target);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: platform !== 'win32',
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      if (platform !== 'win32') child.unref();
      resolve();
    });
  });
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout || console.log;
  const stderr = dependencies.stderr || console.error;
  const fetchImpl = dependencies.fetchImpl || fetch;
  const openBrowser = dependencies.launchBrowser || launchBrowser;

  try {
    const [command, ...args] = argv;
    if (!command || command === 'help' || command === '--help' || command === '-h') {
      stdout(USAGE);
      return 0;
    }

    const apiBase = normalizeApiBase(dependencies.apiUrl || process.env.SNIP_API || DEFAULT_API_URL);

    if (command === 'add') {
      if (args.length !== 1) throw new Error('Usage: snip add <url>');
      validateHttpUrl(args[0]);
      const response = await requestApi(apiBase, '/api/links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: args[0] }),
      }, fetchImpl);
      if (!response.ok) throw await apiError(response);
      const link = await responseJson(response);
      if (typeof link.shortUrl !== 'string') throw new Error('The Snip API response is missing shortUrl.');
      stdout(link.shortUrl);
      return 0;
    }

    if (command === 'ls') {
      if (args.length !== 0) throw new Error('Usage: snip ls');
      const response = await requestApi(apiBase, '/api/links', {}, fetchImpl);
      if (!response.ok) throw await apiError(response);
      const links = await responseJson(response);
      if (!Array.isArray(links)) throw new Error('The Snip API response is not a link list.');
      stdout(formatLinks(links));
      return 0;
    }

    if (command === 'open') {
      if (args.length !== 1 || !args[0]) throw new Error('Usage: snip open <code>');
      const response = await requestApi(
        apiBase,
        `/${encodeURIComponent(args[0])}`,
        { redirect: 'manual' },
        fetchImpl,
      );
      if (response.status === 404) throw new Error(`No link found for code "${args[0]}".`);
      if (response.status !== 302) throw await apiError(response);
      const location = response.headers.get('location');
      if (!location) throw new Error('The Snip API redirect is missing its Location header.');
      const target = validateHttpUrl(location);
      await openBrowser(target, dependencies.platform || process.platform);
      stdout(`Opened ${target}`);
      return 0;
    }

    throw new Error(`Unknown command: ${command}\n${USAGE}`);
  } catch (error) {
    stderr(`Error: ${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}

module.exports = {
  browserCommand,
  formatLinks,
  main,
  normalizeApiBase,
  validateHttpUrl,
};
