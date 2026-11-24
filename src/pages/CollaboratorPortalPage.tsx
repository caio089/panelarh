import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, FileText, ShieldCheck } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Alert, Button, Field, Input, Modal } from '@/components/ui'
import {
  acknowledgeCollaboratorDocument,
  loadCollaboratorPortal,
  type CollaboratorDocument,
  type CollaboratorPortalSnapshot,
} from '@/lib/collaboratorDocuments'
import { formatDateBR } from '@/lib/utils'

const KIND_LABEL: Record<string, string> = {
  holerite: 'Holerite',
  exame_admissional: 'Exame admissional',
  exame_periodico: 'Exame periódico',
  aso: 'ASO',
  contrato: 'Contrato',
  ferias: 'Férias',
  falta: 'Falta',
  atestado: 'Atestado',
  advertencia: 'Advertência',
  suspensao: 'Suspensão',
  comunicado: 'Comunicado',
  outro: 'Documento',
}

export function CollaboratorPortalPage() {
  const { token = '' } = useParams()
  const [snapshot, setSnapshot] = useState<CollaboratorPortalSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signing, setSigning] = useState<CollaboratorDocument | null>(null)
  const [signerName, setSignerName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSnapshot(await loadCollaboratorPortal(token))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir seus documentos.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void reload() }, [reload])

  async function confirmReading() {
    if (!signing) return
    if (!accepted) {
      setFormError('Marque a confirmação de leitura para continuar.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await acknowledgeCollaboratorDocument(token, signing.id, signerName)
      setSigning(null)
      setSignerName('')
      setAccepted(false)
      await reload()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Não foi possível confirmar a leitura.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-3xl bg-[var(--pv-surface)] p-6 shadow-2xl sm:p-8">
          <img src="/logo-panela-horizontal.png" alt="Panela Velha" className="h-10 w-auto" />
          {snapshot ? (
            <div className="mt-7">
              <p className="pv-eyebrow">Portal do colaborador</p>
              <h1 className="mt-1 font-display text-3xl text-[var(--pv-navy)]">Olá, {snapshot.collaborator.full_name}</h1>
              <p className="mt-2 text-sm text-[var(--pv-muted)]">
                {snapshot.collaborator.job_title} · {snapshot.collaborator.unit_name}
              </p>
            </div>
          ) : null}
        </header>

        {loading ? (
          <div className="mt-5 rounded-2xl bg-[var(--pv-surface)] p-8 text-center text-sm text-[var(--pv-muted)] shadow-xl">
            Carregando seus documentos…
          </div>
        ) : error ? (
          <Alert tone="error" className="mt-5">{error}</Alert>
        ) : snapshot ? (
          <section className="mt-5 rounded-3xl bg-[var(--pv-surface)] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-[var(--pv-success)]" size={22} />
              <div>
                <h2 className="font-display text-2xl text-[var(--pv-ink)]">Seus documentos</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--pv-muted)]">
                  Este link é pessoal. Você pode voltar sempre que quiser para consultar contratos, holerites e comunicados.
                </p>
              </div>
            </div>

            {snapshot.documents.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-[#F7F4EC] p-5 text-sm text-[var(--pv-muted)]">
                Ainda não há documentos publicados para você.
              </p>
            ) : (
              <div className="mt-6 space-y-3">
                {snapshot.documents.map((document) => (
                  <article key={document.id} className="rounded-2xl border border-[var(--pv-line)] bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8E8E3] text-[var(--pv-terracotta)]">
                          <FileText size={18} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-[var(--pv-ink)]">{KIND_LABEL[document.kind] || 'Documento'}</h3>
                          <p className="mt-0.5 truncate text-xs text-[var(--pv-muted)]">{document.file_name}</p>
                          {document.competence ? <p className="mt-1 text-xs text-[var(--pv-muted)]">Referência: {formatDateBR(document.competence)}</p> : null}
                          {document.notes ? <p className="mt-2 text-sm text-[var(--pv-muted)]">{document.notes}</p> : null}
                        </div>
                      </div>
                      {document.acknowledged_at ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--pv-success-bg)] px-3 py-1.5 text-xs font-bold text-[var(--pv-success)]">
                          <CheckCircle2 size={14} /> Lido em {formatDateBR(document.acknowledged_at)}
                        </span>
                      ) : document.requires_acknowledgement ? (
                        <span className="rounded-full bg-[#FBF1DC] px-3 py-1.5 text-xs font-bold text-[#A6791F]">Confirmação pendente</span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
                      {document.view_url ? (
                        <a href={document.view_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[var(--pv-line-strong)] px-3 py-2 text-xs font-bold text-[var(--pv-navy)] hover:bg-[#F7F4EC]">
                          <ExternalLink size={14} /> Abrir PDF
                        </a>
                      ) : (
                        <span className="text-xs font-semibold text-[var(--pv-danger)]">PDF indisponível no momento</span>
                      )}
                      {document.requires_acknowledgement && !document.acknowledged_at ? (
                        <Button size="sm" onClick={() => setSigning(document)}>Confirmar leitura</Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>

      <Modal open={Boolean(signing)} title="Confirmar leitura" onClose={() => !saving && setSigning(null)}>
        <form onSubmit={(event) => { event.preventDefault(); void confirmReading() }} className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--pv-muted)]">
            Ao confirmar, ficará registrado que você teve acesso e declarou ter lido este documento.
          </p>
          <Field label="Seu nome completo">
            <Input value={signerName} onChange={(event) => setSignerName(event.target.value)} minLength={2} maxLength={120} required />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#F7F4EC] p-3 text-sm font-semibold text-[var(--pv-ink)]">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" />
            Declaro que abri e li o documento acima.
          </label>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSigning(null)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving || !signerName.trim()}>{saving ? 'Confirmando…' : 'Confirmar leitura'}</Button>
          </div>
        </form>
      </Modal>
    </main>
  )
}
