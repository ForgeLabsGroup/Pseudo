import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@pseudo/shared', '@pseudo/media'],
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
};
export default config;
