# Snip CLI

A zero-dependency Node.js command-line client for the Snip URL shortener.
Requires Node.js 20 or later.

```sh
node cli.js help
node cli.js add https://example.com
node cli.js ls
node cli.js open <code>
```

Set `SNIP_API` to the backend origin when it is not running at
`http://localhost:3000`. The `snip` and `snip.cmd` wrappers work without a
global install; `snip.ps1` provides the equivalent PowerShell entry point.

Run the built-in tests with `npm test`.
