/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // @react-pdf/renderer must run as a real Node module (fontkit/native deps), not be bundled.
  experimental: { serverComponentsExternalPackages: ['@react-pdf/renderer'] },
};
