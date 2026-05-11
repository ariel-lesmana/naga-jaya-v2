/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
  allowedDevOrigins: ['debian-1.tail281837.ts.net'],
};

module.exports = nextConfig;
