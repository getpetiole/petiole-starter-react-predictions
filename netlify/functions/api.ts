// The site's own API on Netlify: /api/* sent on to the Petiole API, for the
// routes in server/routes.ts only (server/forward.ts). PETIOLE_API_KEY, set
// in the site's environment on Netlify, is used for a request that brings no
// key of its own: for a private site only, since every visitor spends it.
import { forward } from "../../server/forward.ts";

export default (request: Request) => forward(request, { apiKey: process.env.PETIOLE_API_KEY || undefined });

export const config = { path: "/api/*" };
