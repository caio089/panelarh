import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** Consulta da Saipos passa por este servidor, uma requisição por vez. */

function dirceuApi(token: string): Plugin {
  return {
    name: 'dirceu-saipos',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/dirceu')) return next()
        try {
          const { pipeDirceuReport } = await import('./server/saiposDirceu.js')
          const { isAdminRequest } = await import('./server/staffAccess.js')
          if (!isAdminRequest(req)) {
            res.statusCode = 401
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Acesso restrito ao admin.' }))
            return
          }
          const params = new URL(url, 'http://127.0.0.1').searchParams
          const dia = params.get('dia') ?? ''
          const categoria = params.get('categoria') ?? ''
          const periodo = params.get('periodo') ?? 'dia'
          const fresh = params.get('atualiza') === '1'
          const controller = new AbortController()
          const stop = () => {
            if (!res.writableEnded) controller.abort()
          }
          req.on('close', stop)
          await pipeDirceuReport(dia, categoria, token, controller.signal, periodo, res, fresh)
        } catch (error) {
          if (res.writableEnded || (error instanceof Error && error.name === 'AbortError')) return
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Falha ao consultar a operação do Dirceu.' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  return {
    plugins: [react(), tailwindcss(), dirceuApi(env.API_SAIPOS ?? '')],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
  }
})
