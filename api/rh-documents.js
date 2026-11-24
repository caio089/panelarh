import { createClient } from '@supabase/supabase-js'

const BUCKET = 'rh-documentos'

function jsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 40_000) {
        reject(Object.assign(new Error('Dados maiores que o permitido.'), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(Object.assign(new Error('Dados inválidos.'), { statusCode: 400 }))
      }
    })
    req.on('error', () => reject(Object.assign(new Error('Falha ao ler os dados.'), { statusCode: 400 })))
  })
}

function clients() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !publicKey || !secretKey) {
    throw Object.assign(new Error('O serviço de documentos ainda não está configurado no servidor.'), { statusCode: 503 })
  }
  return {
    publicClient: createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    serviceClient: createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  }
}

function rpcError(error) {
  const message = error?.message || 'Não foi possível concluir a operação.'
  const statusCode = /sessão|link inválido|expirado/i.test(message) ? 401 : 400
  return Object.assign(new Error(message), { statusCode })
}

async function signedDocuments(serviceClient, documents) {
  return Promise.all((documents || []).map(async ({ storage_path: storagePath, ...document }) => {
    if (!storagePath) return { ...document, view_url: null }
    const { data, error } = await serviceClient.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 15 * 60)
    if (error) return { ...document, view_url: null }
    return { ...document, view_url: data.signedUrl }
  }))
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const { publicClient, serviceClient } = clients()

    if (req.method === 'GET') {
      const shareToken = typeof req.query?.share === 'string' ? req.query.share : ''
      if (!shareToken) return res.status(400).json({ error: 'Link inválido.' })
      const { data, error } = await publicClient.rpc('collaborator_portal_snapshot', { p_token: shareToken })
      if (error) throw rpcError(error)
      return res.status(200).json({
        collaborator: data.collaborator,
        documents: await signedDocuments(serviceClient, data.documents),
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
    const body = await jsonBody(req)

    if (body.action === 'upload-url') {
      const { data, error } = await publicClient.rpc('rh_prepare_document_upload', {
        p_token: String(body.rhToken || ''),
        p_collaborator_id: body.collaboratorId,
        p_kind: body.kind,
        p_competence: body.competence || null,
        p_notes: body.notes || '',
        p_file_name: body.fileName,
        p_content_type: body.contentType,
        p_file_size_bytes: body.fileSize,
        p_requires_acknowledgement: body.requiresAcknowledgement !== false,
        p_source_kind: body.sourceKind || null,
        p_source_id: body.sourceId || null,
      })
      if (error) throw rpcError(error)
      const signed = await serviceClient.storage.from(BUCKET).createSignedUploadUrl(data.storage_path)
      if (signed.error) {
        await publicClient.rpc('rh_delete_pending_document', {
          p_token: String(body.rhToken || ''),
          p_document_id: data.document_id,
        })
        throw Object.assign(new Error('Não foi possível preparar o envio do PDF.'), { statusCode: 503 })
      }
      return res.status(200).json({
        documentId: data.document_id,
        path: data.storage_path,
        uploadToken: signed.data.token,
      })
    }

    if (body.action === 'admin-snapshot') {
      const { data, error } = await publicClient.rpc('rh_document_portal_admin', {
        p_token: String(body.rhToken || ''),
        p_collaborator_id: body.collaboratorId,
      })
      if (error) throw rpcError(error)
      return res.status(200).json({
        portal: data.portal,
        documents: await signedDocuments(serviceClient, data.documents),
      })
    }

    return res.status(400).json({ error: 'Ação inválida.' })
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Não foi possível acessar os documentos agora.',
    })
  }
}
