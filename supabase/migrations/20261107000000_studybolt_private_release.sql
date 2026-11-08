-- Match the existing production client's private-only sharing policy. Public
-- discovery/link sharing must stay unavailable until moderation is implemented.
-- No content, memberships, Auth users, or other products' tables are modified.
revoke execute on function public.get_shared_study_pack(text) from public, anon, authenticated;
revoke execute on function public.list_public_study_packs(text, text, uuid, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.list_community_classes(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.get_community_class(uuid) from public, anon, authenticated;
revoke execute on function public.increment_shared_pack_save(text) from public, anon, authenticated;
revoke execute on function public.join_community_class(uuid) from public, anon, authenticated;

-- Restrictive checks also cover direct REST writes and the existing upsert RPC.
-- Owners retain private snapshots, reads, and the ability to revoke old links.
drop policy if exists "StudyBolt release requires private sharing" on public.shared_study_packs;
create policy "StudyBolt release requires private sharing"
  on public.shared_study_packs as restrictive for all to anon, authenticated
  using (true)
  with check (visibility = 'private' or is_active = false or revoked_at is not null);
