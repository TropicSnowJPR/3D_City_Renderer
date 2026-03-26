import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
    test: {
        projects: [{
            test: {
                include: [
                    'src/**/*.test-browser.*.ts'
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
            }
        }, {
            test: {
                include: [
                    'src/**/*.{test}.*.ts'],
                name: 'unit',
                environment: 'node',
            }
        }]
    }
});
