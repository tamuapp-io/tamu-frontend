/** @type {import('next').NextConfig} */
const path = require("path");

const projectRoot = __dirname;

const nextConfig = {
  outputFileTracingRoot: projectRoot,
  // Keep native Tailwind/Lightning CSS packages in Node — Turbopack must not bundle them.
  serverExternalPackages: [
    "lightningcss",
    "@tailwindcss/postcss",
    "@tailwindcss/node",
    "@tailwindcss/oxide",
  ],
  turbopack: {
    root: projectRoot,
  },
};

module.exports = nextConfig;
