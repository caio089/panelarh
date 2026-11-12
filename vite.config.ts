import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** Consulta da Saipos passa por este servidor, uma requisição por vez. */

function selecaoApi(apiKey: string): Plugin {
  return {
    name: 'grok-selecao',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/selecao')) return next()
        try {
          const { rankWithGrok } = await import('./server/grokSelection.js')
          const { isStaffRequest } = await import('./server/staffAccess.js')
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Método não permitido.' }))
            return
          }
          if (!isStaffRequest(req)) {
            res.statusCode = 401
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Acesso restrito ao RH.' }))
            return
          }
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(Buffer.from(chunk))
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as unknown
          const result = await rankWithGrok(body, apiKey)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(result))
        } catch (error) {
          const status = error instanceof Error && 'statusCode' in error ? Number(error.statusCode) : 500
          res.statusCode = Number.isFinite(status) ? status : 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'O Grok não conseguiu analisar agora.',
            }),
          )
        }
      })
    },
  }
}

function apiResponse(res: import('node:http').ServerResponse) {
  return {
    statusCode: 200,
    setHeader(name: string, value: string) {
      res.setHeader(name, value)
    },
    status(code: number) {
      this.statusCode = code
      res.statusCode = code
      return this
    },
    json(body: unknown) {
      res.statusCode = this.statusCode
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(body))
    },
  }
}

/** No dev, /api/kds e /api/competition precisam responder JSON, não o fonte do arquivo. */
function jsonRoute(prefix: string, moduleId: string): Plugin {
  return {
    name: `json-route-${prefix}`,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith(prefix)) return next()
        try {
          const parsed = new URL(url, 'http://127.0.0.1')
          const query: Record<string, string> = {}
          parsed.searchParams.forEach((value, key) => {
            query[key] = value
          })
          Object.assign(req, { query })
          const loaded = await server.ssrLoadModule(moduleId) as { default: (request: unknown, response: unknown) => Promise<void> }
          await loaded.default(req, apiResponse(res))
          if (!res.writableEnded) res.end()
        } catch (error) {
          if (res.writableEnded) return
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha na consulta.' }))
        }
      })
    },
  }
}

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
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) process.env[key] = value
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
      jsonRoute('/api/kds', '/api/kds.js'),
      jsonRoute('/api/competition', '/api/competition.js'),
      dirceuApi(env.API_SAIPOS ?? ''),
      selecaoApi(env.GROQ_API_KEY ?? ''),
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
  }
})
