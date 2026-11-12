import { getSupabase } from '@/lib/supabaseClient'

const BUCKET = 'curriculos'
/** Teto depois da compactação. Foto de currículo cabe bem abaixo disso. */
const TARGET_BYTES = 160 * 1024
const HARD_MAX_BYTES = 400 * 1024
const MAX_EDGES = [1080, 900, 720]
const QUALITIES = [0.68, 0.58, 0.48, 0.4]
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

function fileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (file.type === 'image/jpeg' || fromName === 'jpg' || fromName === 'jpeg') return 'jpg'
  if (file.type === 'image/png' || fromName === 'png') return 'png'
  if (file.type === 'image/webp' || fromName === 'webp') return 'webp'
  if (file.type === 'image/heic' || file.type === 'image/heif' || fromName === 'heic' || fromName === 'heif') return 'heic'
  return ''
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function resumeFileLabel(file: File | null) {
  if (!file) return 'Nenhuma foto selecionada'
  return `${file.name} · ${formatSize(file.size)} · compacta no envio`
}

export function assertResumeFile(file: File) {
  const ext = fileExtension(file)
  if (!ext || (!IMAGE_MIME.has(file.type) && !['jpg', 'png', 'webp', 'heic'].includes(ext))) {
    throw new Error('Manda uma foto do currículo (JPG, PNG ou WEBP). PDF e Word pesam demais no armazenamento.')
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('A foto pode ter no máximo 8 MB. O sistema compacta antes de guardar.')
  }
  return ext
}

function pathFromPublicUrl(url: string | null | undefined) {
  if (!url) return ''
  const index = url.indexOf(PUBLIC_MARKER)
  if (index < 0) return ''
  return decodeURIComponent(url.slice(index + PUBLIC_MARKER.length).split('?')[0])
}

function canvasToFile(canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg', quality: number, name: string) {
  return new Promise<File | null>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          resolve(null)
          return
        }
        const ext = type === 'image/webp' ? 'webp' : 'jpg'
        resolve(new File([blob], name.replace(/\.[a-z0-9]+$/i, `.${ext}`), { type }))
      },
      type,
      quality,
    )
  })
}

async function drawResume(file: File, maxEdge: number) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Não foi possível compactar esta foto. Tente outra.')
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/** Foto vira WebP (ou JPEG) pequeno. PDF/Word não entram: pesam 10 a 50 vezes mais. */
export async function prepareResumeFile(file: File) {
  assertResumeFile(file)

  let best: File | null = null
  try {
    for (const edge of MAX_EDGES) {
      const canvas = await drawResume(file, edge)
      for (const type of ['image/webp', 'image/jpeg'] as const) {
        for (const quality of QUALITIES) {
          const candidate = await canvasToFile(canvas, type, quality, file.name)
          if (!candidate) continue
          if (!best || candidate.size < best.size) best = candidate
          if (candidate.size <= TARGET_BYTES) return candidate
        }
      }
    }
  } catch {
    throw new Error('Não deu para ler esta foto. Tire de novo em JPG ou PNG, bem nítida.')
  }

  if (!best || best.size > HARD_MAX_BYTES) {
    throw new Error('A foto ainda ficou pesada depois de compactar. Tire mais de longe ou em um ambiente mais claro.')
  }
  return best
}

export async function uploadCurriculo(file: File, vagaId: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Não foi possível anexar o currículo neste ambiente.')
  const ready = await prepareResumeFile(file)
  const ext = ready.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${vagaId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, ready, {
    upsert: false,
    contentType: ready.type,
  })
  if (error) throw new Error('Não foi possível enviar o currículo. Tente outra foto.')
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, nome: ready.name.slice(0, 160) }
}

export async function deleteCurriculo(url: string | null | undefined) {
  const path = pathFromPublicUrl(url)
  if (!path) return
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.storage.from(BUCKET).remove([path])
}

export async function deleteCurriculosDaVaga(vagaId: string, urls: Array<string | null | undefined> = []) {
  const supabase = getSupabase()
  if (!supabase || !vagaId) return
  const fromUrls = urls.map(pathFromPublicUrl).filter(Boolean)
  const { data } = await supabase.storage.from(BUCKET).list(vagaId, { limit: 200 })
  const fromFolder = (data ?? []).map((item) => `${vagaId}/${item.name}`)
  const paths = [...new Set([...fromUrls, ...fromFolder])]
  if (paths.length === 0) return
  await supabase.storage.from(BUCKET).remove(paths)
}
