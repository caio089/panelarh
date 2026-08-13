import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const dbPath = path.join(dataDir, 'panelarh.db')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
db.exec(schema)

function seedIfEmpty() {
  const usersCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  if (usersCount > 0) return

  const adminId = 'user-admin'
  const hash = bcrypt.hashSync('admin123', 10)
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
    adminId,
    'admin@panela.local',
    hash,
  )
  db.prepare(`
    INSERT INTO profiles (id, email, full_name, role, onboarding_completed)
    VALUES (?, ?, ?, 'admin', 1)
  `).run(adminId, 'admin@panela.local', 'Admin Panela')

  console.log('[sqlite] Seed aplicado (admin@panela.local / admin123). Unidades são criadas no painel.')
}

seedIfEmpty()

export function newId() {
  return randomUUID()
}

export function mapProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    unit_id: row.unit_id,
    phone: row.phone,
    cpf: row.cpf,
    city: row.city,
    birth_date: row.birth_date,
    desired_role: row.desired_role,
    availability: row.availability,
    salary_expectation: row.salary_expectation,
    linkedin: row.linkedin,
    disc_d: row.disc_d,
    disc_i: row.disc_i,
    disc_s: row.disc_s,
    disc_c: row.disc_c,
    onboarding_completed: Boolean(row.onboarding_completed),
  }
}

export function createSession(userId) {
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString()
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt,
  )
  return token
}

export function getSessionUser(token) {
  if (!token) return null
  const row = db
    .prepare(
      `
    SELECT u.id AS user_id, u.email, p.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN profiles p ON p.id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `,
    )
    .get(token)
  if (!row) return null
  return {
    user: { id: row.user_id, email: row.email },
    profile: mapProfile(row),
  }
}
