import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { cpSync, existsSync, readFileSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)))

// /data at the repo root is the database (append-only JSON committed by the
// cron jobs). This plugin serves it during `npm run dev` and copies it into
// dist/ on build so GitHub Pages ships it as static files.
function dataDir(): Plugin {
  return {
    name: 'serve-and-copy-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const rel = normalize((req.url ?? '/').split('?')[0]).replace(/^(\.\.[/\\])+/, '')
        const file = join(root, 'data', rel)
        if (file.startsWith(join(root, 'data')) && existsSync(file) && file.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json')
          res.end(readFileSync(file))
        } else {
          next()
        }
      })
    },
    closeBundle() {
      if (existsSync(join(root, 'data'))) {
        cpSync(join(root, 'data'), join(root, 'dist', 'data'), { recursive: true })
      }
    },
  }
}

// base './' makes the build path-independent, so it works on GitHub Pages
// regardless of the repository name.
export default defineConfig({
  base: './',
  plugins: [react(), dataDir()],
})
