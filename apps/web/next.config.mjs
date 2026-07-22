/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@faceless/avatar-core"],
  reactStrictMode: true,
};
export default nextConfig;
