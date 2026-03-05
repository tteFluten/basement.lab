/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["geist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/favicon.gif",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
