/** @type {import('next').NextConfig} */
const nextConfig = {
  // QuikIT production images are built from Next.js standalone output (multi-stage Docker -> GHCR -> GKE).
  output: 'standalone',
  // typedRoutes was removed: Link hrefs in Home/menus are plain strings, which `next build` rejects under typedRoutes.
};
export default nextConfig;
