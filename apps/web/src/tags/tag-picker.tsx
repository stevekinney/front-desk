import { useState } from 'react';

import type { Tag } from '@front-desk/contract';

import { useApi } from '../use-api.ts';
import { TagChip } from './tag-chip.tsx';
import { addTagToTicket, listTags, removeTagFromTicket } from './tags-api.ts';

export function TagPicker({
  ticketId,
  tags,
  onChange,
}: {
  ticketId: number;
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
}) {
  const { data: allTags = [] } = useApi(listTags, 'tags');
  const [selected, setSelected] = useState('');
  const available = allTags.filter((tag) => !tags.some((t) => t.id === tag.id));

  async function add(tagId: number) {
    onChange(await addTagToTicket(ticketId, tagId));
    setSelected('');
  }

  async function remove(tagId: number) {
    onChange(await removeTagFromTicket(ticketId, tagId));
  }

  return (
    <div className="tag-picker">
      {tags.map((tag) => (
        <TagChip key={tag.id} tag={tag} onRemove={() => void remove(tag.id)} />
      ))}
      <select
        aria-label="Add tag"
        value={selected}
        onChange={(event) => {
          setSelected(event.target.value);
          if (event.target.value) void add(Number(event.target.value));
        }}
      >
        <option value="">+ Add tag</option>
        {available.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
    </div>
  );
}
