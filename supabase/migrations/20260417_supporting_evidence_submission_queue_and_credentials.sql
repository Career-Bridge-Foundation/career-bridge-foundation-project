-- ---------- Simulations: add slug support ----------
alter table if exists public.simulations
  add column if not exists slug text;

update public.simulations
set slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))
where (slug is null or btrim(slug) = '')
  and title is not null;

create unique index if not exists idx_simulations_slug_unique on public.simulations(slug);

-- ---------- Attempts: submission and evaluation status ----------
alter table if exists public.attempts
  add column if not exists submitted_at timestamp with time zone,
  add column if not exists evaluation_status text default 'not_started';

create index if not exists idx_attempts_status on public.attempts(status);
create index if not exists idx_attempts_evaluation_status on public.attempts(evaluation_status);

-- ---------- Evaluation jobs queue ----------
create table if not exists public.evaluation_jobs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  queued_at timestamp with time zone not null default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text
);

create index if not exists idx_evaluation_jobs_status_queued_at on public.evaluation_jobs(status, queued_at asc);

-- ---------- Supporting evidence attachments ----------
create table if not exists public.attempt_attachments (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  prompt_index integer not null,
  attachment_type text not null check (attachment_type in ('file', 'url')),
  file_name text,
  file_mime_type text,
  file_size_bytes bigint,
  storage_path text,
  external_url text,
  virus_scan_status text not null default 'pending' check (virus_scan_status in ('pending', 'clean', 'infected', 'skipped')),
  virus_scan_details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_attempt_attachments_attempt_prompt on public.attempt_attachments(attempt_id, prompt_index, created_at asc);

-- ---------- Disciplines lookup ----------
create table if not exists public.disciplines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamp with time zone not null default now()
);

insert into public.disciplines (name, slug)
values
  ('Product Management', 'product-management'),
  ('Data Analytics', 'data-analytics'),
  ('UX Design', 'ux-design')
on conflict (slug) do nothing;

-- ---------- Public credential verification ----------
create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references public.attempts(id) on delete set null,
  verification_code text not null unique,
  candidate_name text not null,
  discipline text not null,
  credential_title text not null,
  issued_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  certifier_credential_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_credentials_verification_code on public.credentials(verification_code);

-- ---------- Private storage bucket for supporting evidence ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supporting-evidence',
  'supporting-evidence',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
