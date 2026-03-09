import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Use happy-dom as default environment — faster than jsdom for Node-only tests.
    // Individual files can override with @vitest-environment node comment.
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'android', 'ios', 'tests/e2e/**', 'src/_archived-mining/**', 'tests/unit/_archived/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Thresholds enforced in CI. Kept at 40% to allow gradual ramp-up.
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40,
      },
      include: [
        'src/services/sm2.ts',
        'src/data/balance.ts',
        'src/data/interestConfig.ts',
        'src/services/interestSpawner.ts',
        'src/game/systems/MineGenerator.ts',
        'src/game/systems/TickSystem.ts',
        'src/game/managers/SaveManager.ts',
        // CompanionManager.ts and QuizManager.ts archived
      ],
    },
  },
})
