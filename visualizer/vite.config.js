import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  plugins: [
    // bundle everything into a single `index.html`
    viteSingleFile(),
  ],
  base: ''
})