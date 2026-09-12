-- Share links contain a server-validated, generated-study-content snapshot.
-- They never expose the source upload or the owner's progress tables.
create table if not exists public.shared_study_packs (
  id uuid primary key default gen_random_uuid(),
  share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  study_pack_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'link' check (visibility in ('private', 'link')),
  shared_content jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  revoked_at timestamptz,
  is_active boolean not null default true,
  constraint shared_study_packs_content_is_object check (jsonb_typeof(shared_content) = 'object')
);

create unique index if not exists shared_study_packs_share_token_idx on public.shared_study_packs(share_token);
create index if not exists shared_study_packs_owner_idx on public.shared_study_packs(owner_user_id);

alter table public.shared_study_packs enable row level security;

drop policy if exists "owners can create shared packs" on public.shared_study_packs;
create policy "owners can create shared packs"
  on public.shared_study_packs for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "owners can view shared packs" on public.shared_study_packs;
create policy "owners can view shared packs"
  on public.shared_study_packs for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "owners can update shared packs" on public.shared_study_packs;
create policy "owners can update shared packs"
  on public.shared_study_packs for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Recipients call this function instead of selecting the table directly. This
-- prevents owner_user_id, study_pack_id, lifecycle columns, and any future
-- private columns from becoming part of the public share response.
create or replace function public.get_shared_study_pack(p_share_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'content', shared_content
  )
  from public.shared_study_packs
  where share_token = p_share_token
    and visibility = 'link'
    and is_active = true
    and revoked_at is null
    and (expires_at is null or expires_at > timezone('utc', now()))
  limit 1;
$$;

revoke all on function public.get_shared_study_pack(text) from public;
grant execute on function public.get_shared_study_pack(text) to anon, authenticated;

create or replace function public.revoke_shared_study_pack(p_share_token text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.shared_study_packs
  set is_active = false,
      revoked_at = timezone('utc', now())
  where share_token = p_share_token
    and owner_user_id = auth.uid()
    and is_active = true;
  return found;
end;
$$;

revoke all on function public.revoke_shared_study_pack(text) from public;
grant execute on function public.revoke_shared_study_pack(text) to authenticated;
