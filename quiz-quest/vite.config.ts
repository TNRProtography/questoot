import path from 'path';
import { defineConfig } from 'vite';

// We have removed loadEnv and the define block as they are no longer needed
// for exposing the VITE_GEMINI_API_KEY.

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});