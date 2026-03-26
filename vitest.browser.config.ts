// Vitest.browser.config.ts
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    // Simpler include: any file that ends with .test-browser.ts
    include: [
      'src/**/*.test-browser.ts',
    ],
    name: 'browser',
    browser: {
      enabled: true,
      headless: false,
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
      provider: playwright(),
    },
  },
});
