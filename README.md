# Snip frontend

Angular 19 client for the Snip URL shortener. It uses the API at
`http://localhost:3000` to create and list links.

## Run

```sh
npm install
npx ng serve
```

Open `http://localhost:4200`. Start the Snip backend separately with `bun start`.
The development server calls the backend directly, which allows the API's CORS
support to handle the cross-origin request.

## Build

```sh
npx ng build
```

The production files are written to `dist/snip-frontend/browser`.
