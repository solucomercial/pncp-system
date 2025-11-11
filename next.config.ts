// Arquivo: next.config.ts

/** @type {import('next').NextConfig} */
const config = {
  // Esta linha é essencial para ajudar o Next.js
  // a processar o pacote 'pdfjs-dist'
  transpilePackages: ['pdfjs-dist'],
};

export default config;