-- Novas candidaturas só podem ser registradas com o currículo anexado.
-- O CHECK NOT VALID preserva os registros antigos que ainda não têm arquivo.
alter table public.candidatos
  add constraint candidatos_curriculo_obrigatorio
  check (
    nullif(btrim(curriculo_url), '') is not null
    and nullif(btrim(curriculo_nome), '') is not null
  ) not valid;
