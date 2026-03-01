/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      // Production API domain — add your backend hostname here
      ...(process.env.NEXT_PUBLIC_API_URL
        ? [
            {
              protocol: new URL(process.env.NEXT_PUBLIC_API_URL).protocol.replace(':', ''),
              hostname: new URL(process.env.NEXT_PUBLIC_API_URL).hostname,
            },
          ]
        : []),
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Kenya Audit Transparency',
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  },
  // Proxy API requests through Next.js to avoid CORS preflight overhead
  // Browser → Next.js (:3000/api/v1/*) → FastAPI (:8000/api/v1/*)
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    // eslint-disable-next-line no-console
    console.log(`[next.config] API rewrite target: ${apiUrl}`);
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
  // Add caching headers for static and API responses
  async headers() {
    return [
      {
        // Cache static assets aggressively
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;
