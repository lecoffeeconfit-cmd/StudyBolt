-- Local-first PowerPoint visual metadata. The uploaded source and image bytes are
-- never stored here. This table only lets the server verify that a signed-in
-- user is asking about a visual that belonged to their own processed document.

create table if not exists public.studybolt_visual_documents (
  document_id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_file_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '30 days'
);

create table if not exists public.studybolt_visuals (
  document_id uuid not null references public.studybolt_visual_documents(document_id) on delete cascade,
  visual_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  slide_number integer not null check (slide_number > 0),
  slide_title text not null default '',
  image_hash text not null,
  visual_type text not null default 'unknown',
  educational_importance numeric(4, 3) not null default 0 check (educational_importance between 0 and 1),
  local_confidence numeric(4, 3) not null default 0 check (local_confidence between 0 and 1),
  needs_user_review boolean not null default false,
  status text not null default 'needs_review',
  reason text,
  analysis_json jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (document_id, visual_id)
);

create index if not exists studybolt_visual_documents_owner_created_idx
  on public.studybolt_visual_documents(owner_user_id, created_at desc);

create index if not exists studybolt_visuals_owner_hash_idx
  on public.studybolt_visuals(owner_user_id, image_hash);

alter table public.studybolt_visual_documents enable row level security;
alter table public.studybolt_visuals enable row level security;
revoke all on public.studybolt_visual_documents from anon, authenticated;
revoke all on public.studybolt_visuals from anon, authenticated;
grant all on public.studybolt_visual_documents to service_role;
grant all on public.studybolt_visuals to service_role;
