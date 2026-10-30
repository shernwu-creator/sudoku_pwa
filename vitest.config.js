import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    reporters: process.env.CI ? 'default' : 'default',
  },
})
