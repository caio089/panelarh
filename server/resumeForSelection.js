const VISION_MODEL = 'qwen/qwen3.8-27b'
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_RESUME_BYTES = 4 * 1024 * 1024
const VISION_TIMEOUT_MS = 25000

const DOCUMENT_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g
const PHONE_RE = /\b(?:\+?55)?\s*\d{2}\s*9?\d{4,5}-?\d{4}\b/g
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export function isResumeStorageUrl(url) {
  try {
    const parsed = new URL(String(url || ''))
    return parsed.protocol === 'https:' && parsed.pathname.includes('/storage/v1/object/public/curriculos/')
  } catch {
    return false
  }
}

export function stripSensitiveResume(text) {
  return String(text || '')
    .replace(DOCUMENT_RE, '[documento]')
    .replace(PHONE_RE, '[telefone]')
    .replace(EMAIL_RE, '[email]')
    .replace(/\s+/g, ' ')
    .trim()
}

function clip(text, max) {
  return stripSensitiveResume(text).slice(0, max)
}

function fileKind(bytes, contentType) {
  const type = String(contentType || '').toLowerCase()
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp'
  }
  if (type.includes('pdf')) return 'pdf'
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg'
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  return ''
}

function mimeForKind(kind) {
  if (kind === 'png') return 'image/png'
  if (kind === 'webp') return 'image/webp'
  if (kind === 'jpeg') return 'image/jpeg'
  return ''
}

/** Texto solto de PDF gerado no computador. PDF de foto escaneada quase nunca tem isso. */
export function extractPdfText(bytes) {
  const raw = Buffer.from(bytes).toString('latin1')
  if (!raw.startsWith('%PDF')) return ''
  const parts = []
  const pattern = /\((?:\\.|[^\\)]){4,}\)/g
  let match
  while ((match = pattern.exec(raw))) {
    const decoded = match[0]
      .slice(1, -1)
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
    if (/[A-Za-zÀ-ú]{4,}/.test(decoded)) parts.push(decoded)
  }
  return clip(parts.join(' '), 900)
}

async function groqVision(apiKey, dataUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0.1,
        max_completion_tokens: 500,
        messages: [
          {
            role: 'system',
            content:
              'Leia o currículo da foto. Extraia só o que importa para emprego em restaurante: cargos, empresas, período, o que a pessoa fazia e escolaridade se aparecer. Não copie CPF, RG, telefone, e-mail, endereço, conta bancária nem descreva o rosto. Se não for um currículo, diga isso em uma frase. Texto corrido em português.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Leia este currículo e resuma o que a pessoa já fez.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    })
    if (!response.ok) return ''
    const payload = await response.json()
    const message = payload?.choices?.[0]?.message
    return clip(message?.content || message?.reasoning || '', 900)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

async function fetchResumeBytes(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error' })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length || buffer.length > MAX_RESUME_BYTES) return null
    return { bytes: buffer, contentType: response.headers.get('content-type') || '' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function readResumeForSelection(url, apiKey) {
  if (!isResumeStorageUrl(url) || !apiKey) {
    return { text: '', fonte: 'sem_arquivo' }
  }
  const file = await fetchResumeBytes(url)
  if (!file) return { text: '', fonte: 'nao_baixou' }

  const kind = fileKind(file.bytes, file.contentType)
  if (kind === 'pdf') {
    const text = extractPdfText(file.bytes)
    return text
      ? { text, fonte: 'pdf' }
      : { text: '', fonte: 'pdf_sem_texto' }
  }

  const mime = mimeForKind(kind)
  if (!mime) return { text: '', fonte: 'tipo_nao_lido' }

  const dataUrl = `data:${mime};base64,${file.bytes.toString('base64')}`
  const text = await groqVision(apiKey, dataUrl)
  return text ? { text, fonte: 'foto' } : { text: '', fonte: 'foto_ilegivel' }
}

async function mapPool(items, limit, worker) {
  const out = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      out[index] = await worker(items[index], index)
    }
  }
  const size = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: size }, run))
  return out
}

export async function attachResumes(pessoas, apiKey) {
  return mapPool(pessoas, 2, async (person) => {
    const resume = await readResumeForSelection(person.curriculoUrl, apiKey)
    return {
      id: person.id,
      nome: person.nome,
      experiencia: person.experiencia,
      respostas: person.respostas,
      curriculo: resume.text,
      curriculoLido: Boolean(resume.text),
      curriculoFonte: resume.fonte,
    }
  })
}

export function resumeReadLabel(fonte) {
  if (fonte === 'foto') return 'Leu a foto do currículo'
  if (fonte === 'pdf') return 'Leu o texto do PDF'
  if (fonte === 'pdf_sem_texto') return 'PDF antigo sem texto para ler'
  if (fonte === 'foto_ilegivel') return 'A foto do currículo não deu para ler'
  if (fonte === 'sem_arquivo') return 'Sem currículo anexado'
  return 'Currículo não lido'
}
