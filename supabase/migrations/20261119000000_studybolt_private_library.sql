begin;

-- StudyBolt account deletion already cascades through studybolt_accounts.
create table public.studybolt_library_items (
  user_id uuid not null references public.studybolt_accounts(user_id) on delete cascade,
  kind text not null check (kind in ('class', 'pack')),
  item_id text not null check (length(item_id) between 1 and 200),
  edited_at timestamptz not null,
  content jsonb not null check (jsonb_typeof(content) = 'object' and (content->>'id') is not distinct from item_id),
  primary key (user_id, kind, item_id)
);

alter table public.studybolt_library_items enable row level security;
revoke all on public.studybolt_library_items from public, anon, authenticated;
grant select on public.studybolt_library_items to authenticated;
create policy "StudyBolt accounts read their own library" on public.studybolt_library_items
  for select to authenticated using (
    user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false)
  );

-- The owner comes from the verified JWT. An older device cannot overwrite a newer edit.
create function public.save_studybolt_library_item(p_kind text, p_item_id text, p_edited_at timestamptz, p_content jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users
    where id = auth.uid() and is_anonymous is false
    for key share;
  if owner_id is null then raise exception 'studybolt_account_required' using errcode = '42501'; end if;
  if exists (select 1 from public.studybolt_account_deletions where user_id = owner_id) then
    raise exception 'studybolt_account_deletion_pending' using errcode = '42501';
  end if;
  if p_edited_at is null or p_edited_at > now() + interval '5 minutes'
    or p_content is null or octet_length(p_content::text) > 12582912 then
    raise exception 'studybolt_library_item_invalid' using errcode = '22023';
  end if;
  insert into public.studybolt_accounts(user_id) values (owner_id) on conflict (user_id) do nothing;
  insert into public.studybolt_library_items as current_item(user_id, kind, item_id, edited_at, content)
    values (owner_id, p_kind, p_item_id, p_edited_at, p_content)
    on conflict (user_id, kind, item_id) do update set edited_at = excluded.edited_at, content = excluded.content
    where current_item.edited_at < excluded.edited_at;
  return found;
end;
$$;
revoke all on function public.save_studybolt_library_item(text, text, timestamptz, jsonb) from public, anon;
grant execute on function public.save_studybolt_library_item(text, text, timestamptz, jsonb) to authenticated;

commit;
