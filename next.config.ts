const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Baris di bawah ini adalah kunci untuk meredam bentrok Next 16 (Turbopack) vs Webpack PWA
  turbopack: {}, 
};

export default withPWA(nextConfig);