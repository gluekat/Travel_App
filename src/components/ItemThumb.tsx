import type { ClosetItem } from '../db/types';
import { useObjectUrl } from '../lib/hooks';

const CATEGORY_EMOJI: Record<string, string> = {
  top: '👕',
  bottom: '👖',
  dress: '👗',
  outerwear: '🧥',
  shoes: '👟',
  accessory: '🧢',
  swimwear: '🩱',
  activewear: '🏃',
};

/** Square photo thumbnail, falling back to a category glyph. */
export function ItemThumb({ item, size = 'h-14 w-14' }: { item: Pick<ClosetItem, 'photo' | 'category' | 'name'>; size?: string }) {
  const url = useObjectUrl(item.photo);
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-lg bg-slate-100`}>
      {url ? (
        <img src={url} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xl" aria-hidden="true">
          {CATEGORY_EMOJI[item.category] ?? '👚'}
        </div>
      )}
    </div>
  );
}
