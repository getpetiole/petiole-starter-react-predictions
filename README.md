# Leaf detector: a Petiole API starter for the web

Find the leaves in a photo with the [Petiole API](https://platform.petiole.pro)'s
leaf detector, and see them drawn on it. A small, complete React app on
Netlify, to copy and build your own on.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/getpetiole/petiole-starter-react-predictions)

## What it does

You paste your API key, then drop a photo of leaves, choose one, or take
one with a phone's camera. The app sends it to the leaf detector and
draws what came back on the photo: a box round each leaf, with its label
and the model's confidence. A slider sets the least confidence shown;
the leaves are counted and listed in a table, and you can download them
as CSV, as JSON, or as the photo with the boxes drawn on it (PNG).

![The app with a leaf found on a photo of the calibration pad, at 98% confidence](docs/screenshot.png)

## Five minutes to a first answer

1. Make an API key on [Keys & access](https://platform.petiole.pro/keys)
   in the Petiole platform, for this app only: with the **Leaf area**
   workflow, which runs the leaf detector, and an expiry.
2. Press **Deploy to Netlify** above. Netlify copies this repository to
   your GitHub account and builds the site, in about a minute.
3. Open the site, paste the key, and choose a photo of leaves.

Or on your computer, with Node 24:

```sh
git clone https://github.com/getpetiole/petiole-starter-react-predictions.git
cd petiole-starter-react-predictions
npm ci
npm run dev
```

Open http://localhost:5173 and paste the key. `npm run dev` answers the
site's `/api` itself, as the Netlify Function does once deployed, so it
needs nothing but Node.

## The key

The Petiole API sends no CORS headers, and a key in a page's code can be
read by any script on the page. So the page never calls the API: it calls
the site's own function, `/api`, which calls the API with the key.

- **By default, each visitor uses their own key.** They paste it once; it
  is kept in that browser tab (`sessionStorage`), or on that device
  (`localStorage`) when they tick "Remember". It goes with each call, over
  HTTPS, to the site's function, which passes it on to Petiole and never
  stores or logs it. "Forget the key" removes it.
- **Or the site has its own key**: set `PETIOLE_API_KEY` in the site's
  environment variables on Netlify (for `npm run dev`, in `.env`, as
  `.env.example` shows), and the app no longer asks for one. Do this only
  for a site that only your own people can open, such as one behind
  Netlify's password protection: every visitor spends that key's
  allowance.

Make a key for this app alone, with only the workflow it needs and an
expiry. Your organisation's daily limits bound what any key can spend,
even one that leaks; if one does, revoke it on Keys & access, and it is
refused within a minute.

## Deploying

The **Deploy to Netlify** button makes the site from a copy of this
repository. Or make your own copy first, with **Use this template** on
GitHub, and add it to Netlify as any site from Git. `netlify.toml` holds
the rest:

- the build, `npm run build` into `dist`, on Node 24;
- the function, `netlify/functions/api.ts`, at `/api/*`;
- every page's headers, among them a strict Content Security Policy: the
  page loads nothing but its own files, and calls nothing but its own
  `/api`.

Netlify takes at most 6 MB in a request, and a photo's bytes are sent
base64-encoded, so about 4.5 MB of photo. A JPEG or PNG within that is
sent as it is; anything larger, or another kind of photo the browser can
open, is drawn upright and encoded as a JPEG in the browser, at its own
size and a lower quality until it fits. What comes back is in fractions
of the photo, so it fits the original.

A model that has been idle sleeps, and waking it takes up to a minute.
The app asks the leaf detector's state as it opens, which wakes it, and
sends a photo only once it is ready, so no call waits out its start.

## What it calls

The site's function forwards these routes of the Petiole API, at
`https://api.petiole.pro`, and refuses any other:

| Route | What for |
| --- | --- |
| `GET /v1/models` | The key checked, and the models it may use |
| `GET /v1/models/leaf-detector` | The leaf detector |
| `GET /v1/models/leaf-detector/status` | Whether it is ready; asking wakes it |
| `POST /v1/models/leaf-detector/predictions` | A photo, and the leaves it found |

The page calls them with the Petiole TypeScript SDK,
[`@petiole/sdk`](https://www.npmjs.com/package/@petiole/sdk), pointed at
the site's `/api`. The function passes the API's answers on as they come,
its errors included; each error is shown in words, with the request's ID
to quote if you contact Petiole. It logs one line a request (the route,
the status, the time and the request's ID), never a key.

To call another model, add its routes to `server/routes.ts`.

## What it does not do

- **Measure.** A model finds things; it measures nothing. For the leaves'
  areas in cm², use a workflow, such as Leaf area, through an analysis
  (`POST /v1/analyses`).
- **Keep anything.** No database, no accounts, no analytics, no
  third-party scripts. A key stays in the visitor's browser, a photo in
  the page.
- **Upload large photos.** Uploads by signed URL take PUTs from the
  Petiole platform's own pages only, so a photo goes in the request.

## Development

```sh
npm run dev            # the app, with /api, on http://localhost:5173
npm run lint
npm run typecheck
npm test               # unit tests
npm run test:contract  # through the function to a mock of the API (Prism)
npm run build
npm run e2e            # the built app in Chromium, against the mock
```

The tests never call the Petiole API. The contract and end-to-end tests
use a mock that [Prism](https://github.com/stoplightio/prism) serves from
the API's spec as released with the installed `@petiole/sdk`
([`openapi.yaml`](https://github.com/getpetiole/petiole-sdk-typescript/blob/v0.1.1/openapi.yaml)
at its version's tag), so a new SDK brings its spec to the tests. Last
tested with `@petiole/sdk` 0.1.1, API v1.

## Licence

MIT. Report a vulnerability privately, as [SECURITY.md](SECURITY.md) says.
