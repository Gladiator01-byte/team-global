import nextPWA from 'next-pwa';

const isDev = process.env.NODE_ENV === 'development';

const withPWA = nextPWA({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/offline',
  },
});

const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
