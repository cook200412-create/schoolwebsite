/** @type {import('next').NextConfig} */
const API = (process.env.API_URL ?? 'http://localhost:5000/api').replace(/\/$/, '');

const nextConfig = {
  // lets test builds use a separate folder so they never clobber a running dev server
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { externalDir: true },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }] },
  // Same-origin proxy: browser calls /api/* so HTTP-only auth cookies stay first-party (no cross-site cookie issues).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/:path*` }];
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};
export default nextConfig;
