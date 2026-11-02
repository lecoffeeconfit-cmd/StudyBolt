import type { StudyPack, StudyPackMaterial } from '../models';

export interface HomeUploadStatus {
  deck: StudyPack;
  kind: 'creating' | 'attention' | 'ready';
  ready: number;
  failed: number;
  pending: number;
  missing: number;
  total: number;
}

/** Read existing generation records only; missing/queued tools never count as ready. */
export function getHomeUploadStatus(decks: StudyPack[], expectedMaterials: readonly StudyPackMaterial[]): HomeUploadStatus | null {
  if (!expectedMaterials.length) return null;
  const statuses = decks.filter((deck) => deck.fileType !== 'demo' && deck.generation).map((deck): HomeUploadStatus => {
    const materials = deck.generation!.materials;
    const ready = expectedMaterials.filter((name) => materials[name]?.status === 'ready').length;
    const failed = expectedMaterials.filter((name) => materials[name]?.status === 'failed').length;
    const pending = expectedMaterials.filter((name) => materials[name]?.status === 'queued' || materials[name]?.status === 'generating').length;
    const missing = expectedMaterials.length - ready - failed - pending;
    return { deck, ready, failed, pending, missing, total: expectedMaterials.length, kind: pending ? 'creating' : failed || missing ? 'attention' : 'ready' };
  });
  const priority = { creating: 0, attention: 1, ready: 2 };
  statuses.sort((a, b) => priority[a.kind] - priority[b.kind]
    || (Date.parse(b.deck.createdAt) || 0) - (Date.parse(a.deck.createdAt) || 0)
    || a.deck.id.localeCompare(b.deck.id));
  return statuses[0] ?? null;
}
