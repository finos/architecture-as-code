import { defineConfig } from "cypress";
import 'dotenv/config';

export default defineConfig({
  e2e: {
    baseUrl: process.env.VITE_BASE_URL,
  },
});
