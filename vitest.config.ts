import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
    test: {
        projects: [{
            test: {
                include: [
                    'client/src/**/*.test-browser.*.ts',
                    'server/src/**/*.test-browser.*.ts'
                ],
                name: 'browser',
                browser: {
                    enabled: true,
                    headless: false,
                    instances: [
                        { browser: 'chromium' },
                        // { browser: 'firefox' },
                        // { browser: 'webkit' },
                    ],
                    provider: playwright(),
                },
            }
        }, {
            test: {
                include: [
                    'client/src/**/*.{test}.*.ts',
                    'server/src/**/*.{test}.*.ts',
                ],
                name: 'unit',
                environment: 'node',
            }
        }]
    }
});
