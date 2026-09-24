import type { Tag } from '@front-desk/contract';

export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span className="tag-chip" style={{ borderColor: tag.color, color: tag.color }}>
      {tag.name}
      {onRemove ? (
        <button
          type="button"
          className="tag-remove"
          aria-label={`Remove ${tag.name}`}
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
