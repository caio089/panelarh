import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { db, newId, mapProfile, createSession, getSessionUser } from './db.js'

const app = express()
const PORT = process.env.PORT || 8787

app.use(cors())
app.use(express.json({ limit: '2mb' }))

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const session = getSessionUser(token)
  if (!session) return res.status(401).json({ error: 'Não autenticado' })
  req.session = session
  next()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, engine: 'sqlite', db: 'server/data/panelarh.db' })
})

/** Cadastro de candidato */
app.post('/api/auth/register', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const fullName = String(req.body.fullName || '').trim()

    if (!email || !password || password.length < 3) {
      return res.status(400).json({ error: 'Informe e-mail e senha (mín. 3 caracteres)' })
    }

    const exists = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email)
    if (exists) return res.status(409).json({ error: 'E-mail já cadastrado' })

    const id = newId()
    const hash = bcrypt.hashSync(password, 10)

    const tx = db.transaction(() => {
      db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, email, hash)
      db.prepare(`
        INSERT INTO profiles (id, email, full_name, role, onboarding_completed)
        VALUES (?, ?, ?, 'candidate', 0)
      `).run(id, email, fullName || email.split('@')[0])
    })
    tx()

    const token = createSession(id)
    const profile = mapProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(id))
    res.status(201).json({ token, user: { id, email }, profile })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao criar conta' })
  }
})

/** Login (candidato ou admin) */
app.post('/api/auth/login', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email)
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos' })
    }
    const profile = mapProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(user.id))
    const token = createSession(user.id)
    res.json({ token, user: { id: user.id, email: user.email }, profile })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro no login' })
  }
})

app.post('/api/auth/logout', auth, (req, res) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  res.json({ ok: true })
})

app.get('/api/auth/me', auth, (req, res) => {
  res.json(req.session)
})

app.patch('/api/profile', auth, (req, res) => {
  try {
    const id = req.session.user.id
    const allowed = [
      'full_name',
      'phone',
      'cpf',
      'city',
      'birth_date',
      'desired_role',
      'availability',
      'salary_expectation',
      'linkedin',
      'disc_d',
      'disc_i',
      'disc_s',
      'disc_c',
      'onboarding_completed',
    ]
    const patch = req.body || {}
    const sets = []
    const values = []
    for (const key of allowed) {
      if (patch[key] === undefined) continue
      let val = patch[key]
      if (key === 'onboarding_completed') val = val ? 1 : 0
      sets.push(`${key} = ?`)
      values.push(val)
    }
    if (!sets.length) {
      return res.json({ profile: mapProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(id)) })
    }
    sets.push(`updated_at = datetime('now')`)
    values.push(id)
    db.prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    const profile = mapProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(id))
    res.json({ profile })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar perfil' })
  }
})

app.put('/api/profile/experiences', auth, (req, res) => {
  try {
    const profileId = req.session.user.id
    const list = Array.isArray(req.body.experiences) ? req.body.experiences : []
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM experiences WHERE profile_id = ?').run(profileId)
      const insert = db.prepare(`
        INSERT INTO experiences (id, profile_id, company, role_title, start_date, end_date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const e of list) {
        if (!e.company?.trim() || !e.role_title?.trim()) continue
        insert.run(
          e.id || newId(),
          profileId,
          e.company,
          e.role_title,
          e.start_date || null,
          e.end_date || null,
          e.description || null,
        )
      }
    })
    tx()
    const experiences = db
      .prepare('SELECT * FROM experiences WHERE profile_id = ? ORDER BY created_at')
      .all(profileId)
    res.json({ experiences })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao salvar experiências' })
  }
})

app.put('/api/profile/disc', auth, (req, res) => {
  try {
    const profileId = req.session.user.id
    const answers = req.body.answers || {}
    const scores = req.body.scores || {}
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM disc_answers WHERE profile_id = ?').run(profileId)
      const insert = db.prepare(`
        INSERT INTO disc_answers (id, profile_id, question_key, value) VALUES (?, ?, ?, ?)
      `)
      for (const [key, value] of Object.entries(answers)) {
        insert.run(newId(), profileId, key, Number(value))
      }
      db.prepare(`
        UPDATE profiles
        SET disc_d = ?, disc_i = ?, disc_s = ?, disc_c = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(scores.D || 0, scores.I || 0, scores.S || 0, scores.C || 0, profileId)
    })
    tx()
    res.json({ ok: true, profile: mapProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId)) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao salvar DISC' })
  }
})

app.get('/api/units', (_req, res) => {
  res.json({ units: db.prepare('SELECT * FROM units ORDER BY name').all() })
})

app.get('/api/vagas', (req, res) => {
  const onlyActive = req.query.ativa !== '0'
  const rows = onlyActive
    ? db.prepare('SELECT * FROM vagas WHERE ativa = 1 ORDER BY criada_em DESC').all()
    : db.prepare('SELECT * FROM vagas ORDER BY criada_em DESC').all()
  res.json({
    vagas: rows.map((v) => ({
      ...v,
      ativa: Boolean(v.ativa),
    })),
  })
})

app.get('/api/vagas/:id', (req, res) => {
  const vaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(req.params.id)
  if (!vaga) return res.status(404).json({ error: 'Vaga não encontrada' })
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(vaga.unit_id)
  res.json({ vaga: { ...vaga, ativa: Boolean(vaga.ativa), unitName: unit?.name } })
})

app.post('/api/vagas', auth, (req, res) => {
  if (!['admin', 'lider'].includes(req.session.profile.role)) {
    return res.status(403).json({ error: 'Sem permissão' })
  }
  const id = newId()
  const { unit_id, titulo, descricao, localidade, tipo, ativa } = req.body
  db.prepare(`
    INSERT INTO vagas (id, unit_id, titulo, descricao, localidade, tipo, ativa)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    unit_id,
    titulo,
    descricao || null,
    localidade || null,
    tipo || 'Presencial',
    ativa === false ? 0 : 1,
  )
  res.status(201).json({ id })
})

app.patch('/api/vagas/:id', auth, (req, res) => {
  if (!['admin', 'lider'].includes(req.session.profile.role)) {
    return res.status(403).json({ error: 'Sem permissão' })
  }
  const current = db.prepare('SELECT * FROM vagas WHERE id = ?').get(req.params.id)
  if (!current) return res.status(404).json({ error: 'Vaga não encontrada' })
  const next = {
    unit_id: req.body.unit_id ?? current.unit_id,
    titulo: req.body.titulo ?? current.titulo,
    descricao: req.body.descricao ?? current.descricao,
    localidade: req.body.localidade ?? current.localidade,
    tipo: req.body.tipo ?? current.tipo,
    ativa: req.body.ativa === undefined ? current.ativa : req.body.ativa ? 1 : 0,
  }
  db.prepare(`
    UPDATE vagas SET unit_id=?, titulo=?, descricao=?, localidade=?, tipo=?, ativa=? WHERE id=?
  `).run(next.unit_id, next.titulo, next.descricao, next.localidade, next.tipo, next.ativa, req.params.id)
  res.json({ ok: true })
})

app.delete('/api/vagas/:id', auth, (req, res) => {
  if (!['admin', 'lider'].includes(req.session.profile.role)) {
    return res.status(403).json({ error: 'Sem permissão' })
  }
  db.prepare('DELETE FROM vagas WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

/** Snapshot completo do store para o front (admin / carreiras) */
app.get('/api/store', (_req, res) => {
  const units = db.prepare('SELECT * FROM units ORDER BY name').all()
  const vagas = db
    .prepare('SELECT * FROM vagas ORDER BY criada_em DESC')
    .all()
    .map((v) => ({ ...v, ativa: Boolean(v.ativa) }))
  const profiles = db.prepare('SELECT * FROM profiles').all().map(mapProfile)
  const experiences = db.prepare('SELECT * FROM experiences').all()
  const candidatos = db.prepare('SELECT * FROM candidatos ORDER BY criado_em DESC').all()
  const messages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all()
  res.json({ units, vagas, profiles, experiences, candidatos, messages })
})

app.post('/api/candidaturas', auth, (req, res) => {
  try {
    const profileId = req.session.user.id
    const { vaga_id, experiencia, info_complementar, nome } = req.body
    if (!vaga_id) return res.status(400).json({ error: 'vaga_id obrigatório' })

    const exists = db
      .prepare('SELECT id FROM candidatos WHERE vaga_id = ? AND profile_id = ?')
      .get(vaga_id, profileId)
    if (exists) return res.status(409).json({ error: 'Você já se candidatou a esta vaga.' })

    const profile = mapProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId))
    const id = newId()
    db.prepare(`
      INSERT INTO candidatos (id, vaga_id, profile_id, nome, experiencia, info_complementar, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pendente')
    `).run(
      id,
      vaga_id,
      profileId,
      nome || profile?.full_name || req.session.user.email,
      experiencia || null,
      info_complementar || null,
    )
    res.status(201).json({ id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao candidatar' })
  }
})

app.patch('/api/candidatos/:id/status', auth, (req, res) => {
  if (!['admin', 'lider'].includes(req.session.profile.role)) {
    return res.status(403).json({ error: 'Sem permissão' })
  }
  const { status, data_inicio_treinamento } = req.body
  db.prepare(`
    UPDATE candidatos
    SET status = ?, data_inicio_treinamento = ?
    WHERE id = ?
  `).run(status, status === 'aprovada' ? data_inicio_treinamento || null : null, req.params.id)
  res.json({ ok: true })
})

app.post('/api/messages', auth, (req, res) => {
  if (!['admin', 'lider'].includes(req.session.profile.role)) {
    return res.status(403).json({ error: 'Sem permissão' })
  }
  const id = newId()
  db.prepare(`
    INSERT INTO messages (id, candidato_id, sender_id, body) VALUES (?, ?, ?, ?)
  `).run(id, req.body.candidato_id, req.session.user.id, req.body.body)
  res.status(201).json({ id })
})

app.listen(PORT, () => {
  console.log(`[sqlite] API de teste em http://localhost:${PORT}`)
  console.log(`[sqlite] Admin seed: admin@panela.local / admin123`)
})
