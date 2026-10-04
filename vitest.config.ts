import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    // QuikIT convention: tests live under __tests__/ (unit | api | ...), never tests/.
    include: ['__tests__/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/lib/**/*.ts'], reporter: ['text', 'json-summary'] },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
