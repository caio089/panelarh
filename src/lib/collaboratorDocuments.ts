import { getSupabase } from '@/lib/supabaseClient'
import { rhSessionToken } from '@/lib/rhAccess'

export interface CollaboratorDocument {
  id: string
  kind: string
  status?: string
  competence: string | null
  notes: string
  file_name: string
  file_size_bytes: number
  requires_acknowledgement: boolean
  published_at: string | null
  acknowledged_at: string | null
  signer_name: string | null
  view_url: string | null
}

export interface CollaboratorDocumentAdminSnapshot {
  portal: { active: boolean; created_at?: string; last_accessed_at?: string | null }
  documents: CollaboratorDocument[]
}

export interface CollaboratorPortalSnapshot {
  collaborator: { full_name: string; job_title: string; unit_name: string }
  documents: CollaboratorDocument[]
}

function client() {
  const value = getSupabase()
  if (!value) throw new Error('O banco do RH não está configurado neste ambiente.')
  return value
}

function token() {
  const value = rhSessionToken()
  if (!value) throw new Error('Sua sessão do RH expirou. Entre novamente.')
  return value
}

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload as T
}

export async function uploadCollaboratorPdf(input: {
  collaboratorId: string
  kind: string
  competence?: string
  notes: string
  file: File
  requiresAcknowledgement: boolean
  sourceKind?: 'ocorrencia'
  sourceId?: string
}) {
  if (input.file.type !== 'application/pdf' && !input.file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Selecione um arquivo PDF.')
  }
  if (input.file.size <= 0 || input.file.size > 10 * 1024 * 1024) {
    throw new Error('O PDF precisa ter no máximo 10 MB.')
  }

  const prepared = await responseJson<{ documentId: string; path: string; uploadToken: string }>(
    await fetch('/api/rh-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload-url',
        rhToken: token(),
        collaboratorId: input.collaboratorId,
        kind: input.kind,
        competence: input.competence || null,
        notes: input.notes,
        fileName: input.file.name,
        contentType: 'application/pdf',
        fileSize: input.file.size,
        requiresAcknowledgement: input.requiresAcknowledgement,
        sourceKind: input.sourceKind || null,
        sourceId: input.sourceId || null,
      }),
    }),
  )

  const supabase = client()
  const upload = await supabase.storage.from('rh-documentos').uploadToSignedUrl(
    prepared.path,
    prepared.uploadToken,
    input.file,
    { contentType: 'application/pdf' },
  )
  if (upload.error) {
    await supabase.rpc('rh_delete_pending_document', {
      p_token: token(),
      p_document_id: prepared.documentId,
    })
    throw new Error(upload.error.message || 'Não foi possível enviar o PDF.')
  }
  const complete = await supabase.rpc('rh_complete_document_upload', {
    p_token: token(),
    p_document_id: prepared.documentId,
  })
  if (complete.error) throw new Error(complete.error.message || 'O PDF foi enviado, mas não pôde ser publicado.')
  return prepared.documentId
}

export async function loadDocumentAdminSnapshot(collaboratorId: string) {
  return responseJson<CollaboratorDocumentAdminSnapshot>(await fetch('/api/rh-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'admin-snapshot', rhToken: token(), collaboratorId }),
  }))
}

export async function createCollaboratorPortalLink(collaboratorId: string) {
  const { data, error } = await client().rpc('rh_create_collaborator_portal_link', {
    p_token: token(),
    p_collaborator_id: collaboratorId,
  })
  if (error) throw new Error(error.message || 'Não foi possível criar o link.')
  return `${window.location.origin}/colaborador/${data}`
}

export async function revokeCollaboratorPortalLink(collaboratorId: string) {
  const { error } = await client().rpc('rh_revoke_collaborator_portal_link', {
    p_token: token(),
    p_collaborator_id: collaboratorId,
  })
  if (error) throw new Error(error.message || 'Não foi possível desativar o link.')
}

export async function loadCollaboratorPortal(shareToken: string) {
  return responseJson<CollaboratorPortalSnapshot>(await fetch(`/api/rh-documents?share=${encodeURIComponent(shareToken)}`))
}

export async function acknowledgeCollaboratorDocument(shareToken: string, documentId: string, signerName: string) {
  const { data, error } = await client().rpc('collaborator_acknowledge_document', {
    p_token: shareToken,
    p_document_id: documentId,
    p_signer_name: signerName,
    p_user_agent: window.navigator.userAgent.slice(0, 500),
  })
  if (error) throw new Error(error.message || 'Não foi possível confirmar a leitura.')
  return data as string
}
