import { getSupabase } from '@/lib/supabaseClient'

const BUCKET = 'curriculos'
const MAX_BYTES = 5 * 1024 * 1024

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

function fileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  return MIME_TO_EXT[file.type] || (fromName in EXT_TO_MIME ? fromName : '')
}

export function resumeFileLabel(file: File | null) {
  if (!file) return 'Nenhum arquivo selecionado'
  const size = file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`
  return `${file.name} · ${size}`
}

export function assertResumeFile(file: File) {
  const ext = fileExtension(file)
  if (!ext) throw new Error('Envie PDF, Word ou imagem (JPG/PNG).')
  if (file.size > MAX_BYTES) throw new Error('O currículo pode ter no máximo 5 MB.')
  return ext
}

export async function uploadCurriculo(file: File, vagaId: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Não foi possível anexar o currículo neste ambiente.')
  const ext = assertResumeFile(file)
  const path = `${vagaId}/${crypto.randomUUID()}.${ext}`
  const contentType = file.type || EXT_TO_MIME[ext]
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType,
  })
  if (error) throw new Error('Não foi possível enviar o currículo. Tente outro arquivo.')
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, nome: file.name.slice(0, 160) }
}
