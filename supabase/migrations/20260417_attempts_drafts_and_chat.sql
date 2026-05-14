-- Add draft autosave fields on attempts
alter table if exists public.attempts
  add column if not exists current_step integer,
  add column if not exists last_saved_at timestamp with time zone;

-- Persist coaching chat history for each attempt
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  prompt_index integer not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  task_title text,
  task_description text,
  task_guidance text,
  user_identifier text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_attempts_last_saved_at on public.attempts(last_saved_at desc);
create index if not exists idx_chat_messages_attempt_created on public.chat_messages(attempt_id, created_at asc);
create index if not exists idx_chat_messages_user_identifier_created on public.chat_messages(user_identifier, created_at desc);
