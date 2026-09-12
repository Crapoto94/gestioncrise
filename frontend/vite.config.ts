import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ne jamais coder l'URL de l'API en dur — elle est injectée au build via
// VITE_API_URL (cf. GUIDE_NOUVELLE_APP_VILLE.md §1.1).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
