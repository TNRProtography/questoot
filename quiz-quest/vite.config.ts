import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    // This loads the environment variables from the Cloudflare build environment
    const env = loadEnv(mode, '.', '');
    
    return {
      // This 'define' block makes the key available to your application code
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});