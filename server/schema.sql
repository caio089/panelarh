-- Panela RH — schema SQLite (ambiente de teste)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'candidate'
    CHECK (role IN ('candidate', 'admin', 'lider')),
  unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
  phone TEXT,
  cpf TEXT,
  city TEXT,
  birth_date TEXT,
  desired_role TEXT,
  availability TEXT,
  salary_expectation TEXT,
  linkedin TEXT,
  disc_d REAL DEFAULT 0,
  disc_i REAL DEFAULT 0,
  disc_s REAL DEFAULT 0,
  disc_c REAL DEFAULT 0,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vagas (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  localidade TEXT,
  tipo TEXT DEFAULT 'Presencial',
  ativa INTEGER NOT NULL DEFAULT 1,
  criada_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS experiences (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role_title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS disc_answers (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  UNIQUE (profile_id, question_key)
);

CREATE TABLE IF NOT EXISTS candidatos (
  id TEXT PRIMARY KEY,
  vaga_id TEXT NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  info_complementar TEXT,
  experiencia TEXT,
  referencia TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'entrevista', 'aprovada', 'reprovada', 'banco')),
  data_inicio_treinamento TEXT,
  curriculo_url TEXT,
  curriculo_nome TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  candidato_id TEXT NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vagas_unit ON vagas(unit_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_vaga ON candidatos(vaga_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_profile ON candidatos(profile_id);
CREATE INDEX IF NOT EXISTS idx_experiences_profile ON experiences(profile_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
