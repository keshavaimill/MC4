/** @type {import('next').NextConfig} */

// Backend URL for rewrites (dev and prod when frontend proxies /api to backend).
// Set BACKEND_URL when deploying so /api/* is proxied to your backend (e.g. https://your-api.azurewebsites.net).
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig = {
  reactStrictMode: true,
  // Optional: use for smaller Docker image (output: 'standalone' + copy .next/standalone)
  // output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
