import type { NextConfig } from 'next';
const config: NextConfig = {
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
