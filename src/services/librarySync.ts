import { resolveBackendUrl } from '../config/backend';
import type { StudyBoltState } from '../models';
import { libraryVersion, localLibraryItems, type LibraryItem } from './libraryData';

type ItemIndex = Pick<LibraryItem, 'kind' | 'item_id' | 'edited_at'>;
const PAGE_SIZE = 100;
const itemKey = (item: Pick<LibraryItem, 'kind' | 'item_id'>) => item.kind + ':' + item.item_id;

export async function syncStudyLibrary(
  state: StudyBoltState,
  sampleIds: ReadonlySet<string>,
  userId: string,
  token: string,
  signal: AbortSignal,
  received: (item: LibraryItem) => void,
): Promise<void> {
  const host = resolveBackendUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const apikey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!host || !apikey) throw new Error('Library sync is unavailable');
  const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(host + '/rest/v1/' + path, {
      ...options,
      signal,
      headers: { apikey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Library sync request failed');
    return await response.json() as T;
  };
  const index = new Map<string, ItemIndex>();
  const table = 'studybolt_library_items?user_id=eq.' + encodeURIComponent(userId);
  for (let offset = 0;; offset += PAGE_SIZE) {
    const rows = await request<ItemIndex[]>(table + '&select=kind,item_id,edited_at&order=kind,item_id&limit=' + PAGE_SIZE + '&offset=' + offset);
    for (const row of rows) index.set(itemKey(row), row);
    if (rows.length < PAGE_SIZE) break;
  }

  const local = new Map(state.classes.map(course => ['class:' + course.id, libraryVersion(course)]));
  for (const pack of state.decks) local.set('pack:' + pack.id, libraryVersion(pack));
  const pull = async (item: ItemIndex) => {
    const rows = await request<LibraryItem[]>(table + '&kind=eq.' + item.kind + '&item_id=eq.' + encodeURIComponent(item.item_id) + '&select=kind,item_id,edited_at,content');
    const row = rows[0];
    if (row) received(row);
  };
  for (const [key, item] of index) {
    if (!local.has(key) || Date.parse(item.edited_at) > local.get(key)!) await pull(item);
  }

  let failed = false;
  for (const item of localLibraryItems(state, sampleIds)) {
    const remote = index.get(itemKey(item));
    if (remote && Date.parse(remote.edited_at) >= Date.parse(item.edited_at)) continue;
    try {
      const written = await request<boolean>('rpc/save_studybolt_library_item', {
        method: 'POST',
        body: JSON.stringify({ p_kind: item.kind, p_item_id: item.item_id, p_edited_at: item.edited_at, p_content: item.content }),
      });
      // Another device may have saved an edit since the index was read.
      if (!written) await pull(item);
    } catch (error) {
      if (signal.aborted) throw error;
      failed = true;
    }
  }
  if (failed) throw new Error('Some library items could not sync');
}
