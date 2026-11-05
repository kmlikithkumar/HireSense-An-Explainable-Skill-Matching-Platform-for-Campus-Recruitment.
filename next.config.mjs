/** @type {import('next').NextConfig} */
const nextConfig = {
  // native / wasm packages must not be bundled by webpack
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node', 'sharp', 'pg'],
};
export default nextConfig;
