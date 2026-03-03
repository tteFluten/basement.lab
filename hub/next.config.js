/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["geist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
