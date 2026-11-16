# Snip backend

A zero-dependency Bun URL shortener API. Links are stored in memory and are
cleared when the server restarts.

## Run

```sh
bun start
```

The server listens on port `3000` by default. Set `PORT` to change it and
`BASE_URL` to set the origin used for generated short links. If `BASE_URL` is
unset, `RAILWAY_PUBLIC_DOMAIN` is used when available; otherwise short links
use `http://localhost:<PORT>`. Set `PUBLIC_DIR` to serve static files alongside
the API and redirects; `/` serves `index.html`.

## API

- `POST /api/links` with `{"url":"https://example.com"}` creates a link.
- `GET /api/links` lists links.
- `GET /:code` redirects to the original URL and increments its hit count.
