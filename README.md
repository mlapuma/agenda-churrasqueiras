# Agenda de Churrasqueiras - Condominio Terra Branca

Pagina estatica em HTML, CSS e JavaScript para registrar reservas do salao da churrasqueira por data e casa.

## Como usar

Abra o arquivo `index.html` no navegador ou publique o projeto pelo GitHub Pages usando a branch `main` e a pasta raiz.

## Hospedagem

O site pode continuar hospedado no GitHub Pages. Para que todos os moradores vejam os mesmos agendamentos, configure um banco online no Supabase e preencha o arquivo `config.js`.

## Configurar Supabase

1. Crie um projeto em https://supabase.com.
2. Abra o SQL Editor e execute:

```sql
create table if not exists churrasqueira_reservas (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  house text not null,
  created_at timestamptz not null default now()
);

alter table churrasqueira_reservas enable row level security;

create policy "Permitir leitura publica"
on churrasqueira_reservas
for select
to anon
using (true);

create policy "Permitir cadastro publico"
on churrasqueira_reservas
for insert
to anon
with check (true);

create policy "Permitir exclusao publica"
on churrasqueira_reservas
for delete
to anon
using (true);
```

3. Em Project Settings > API, copie:
   - Project URL
   - anon public key

4. Atualize o arquivo `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://seu-projeto.supabase.co",
  SUPABASE_ANON_KEY: "sua-chave-anon-public"
};
```

5. Envie a alteracao para o GitHub. O GitHub Pages publicara a nova versao.
