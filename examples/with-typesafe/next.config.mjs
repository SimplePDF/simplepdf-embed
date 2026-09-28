/** @type {import('next').NextConfig} */
const nextConfig = {
  // A thin same-origin proxy route (app/api/jev) forwards BYOK calls to JEV, since
  // api.typesafe.ai sends no Access-Control-Allow-Origin for browser-direct calls.
  // That server route means the app is no longer a pure static export; it deploys as
  // a Cloudflare Worker (@opennextjs/cloudflare).
  // CF: plans/P107-typesafe-jev-example.md
  agentRules: false,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
