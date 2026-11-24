import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** Executa os mesmos handlers de produção no servidor de desenvolvimento. */
function localApiRoutes(): Plugin {
  const routes = new Set(['/api/kds', '/api/competition', '/api/saipos', '/api/dirceu', '/api/selecao'])
  return {
    name: 'local-api-routes',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (!routes.has(url.pathname)) return next()
        const legacyDirceu = url.pathname === '/api/dirceu'
        if (legacyDirceu) url.searchParams.set('unidade', 'dirceu')
        Object.assign(req, { query: Object.fromEntries(url.searchParams) })
        Object.assign(res, {
          status(code: number) { res.statusCode = code; return res },
          json(body: unknown) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(body))
          },
        })
        try {
          const route = legacyDirceu ? '/api/saipos' : url.pathname
          const loaded = await server.ssrLoadModule(route + '.js')
          await loaded.default(req, res)
        } catch (error) {
          if (res.writableEnded || res.destroyed) return
          if (res.headersSent) return res.end()
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha na consulta.' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) process.env[key] = value
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
      localApiRoutes(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
  }
})
