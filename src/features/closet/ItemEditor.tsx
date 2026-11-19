import { forwardRef, useState } from 'react';
import type { Category, ClosetItem, GeneralItem } from '../../db/types';
import { GeneralItemForm } from './GeneralItemForm';
import { ItemForm, type ItemFormHandle } from './ItemForm';

export type EditorTarget = { kind: 'closet'; item?: ClosetItem } | { kind: 'general'; item?: GeneralItem };

/**
 * One add/edit form for every kind of item. New items pick a Category (clothing, shoes, accessory… or "general");
 * the item is saved where it belongs, and so appears on the matching tab.
 */
export const ItemEditor = forwardRef<ItemFormHandle, { target: EditorTarget; defaultCategory?: Category | 'general'; onDone: () => void }>(function ItemEditor({ target, defaultCategory, onDone }, ref) {
  const [kind, setKind] = useState<'closet' | 'general'>(target.item ? target.kind : defaultCategory === 'general' ? 'general' : 'closet');
  const [category, setCategory] = useState<Category | undefined>(defaultCategory && defaultCategory !== 'general' ? defaultCategory : undefined);
  const [name, setName] = useState('');

  if (kind === 'general') {
    return (
      <GeneralItemForm
        ref={ref}
        key="general"
        item={target.kind === 'general' ? target.item : undefined}
        initialName={name}
        onKindChange={(c, n) => {
          setName(n);
          setCategory(c);
          setKind('closet');
        }}
        onDone={onDone}
      />
    );
  }
  return (
    <ItemForm
      ref={ref}
      key={`closet-${category ?? ''}`}
      item={target.kind === 'closet' ? target.item : undefined}
      defaultCategory={category}
      initialName={name}
      onKindChange={(_k, n) => {
        setName(n);
        setKind('general');
      }}
      onDone={onDone}
    />
  );
});
