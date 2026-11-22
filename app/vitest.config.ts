// Tests du front (Vitest) : règles de calcul et de formatage, sans navigateur ni plugins de build.
// Lancer : npm test (audit, constat QUA-01).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Constante injectée au build par vite.config.ts (adresse de contact codée) : vide pour les tests
  define: { __CONTACT_CODE__: JSON.stringify('') },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
