import { Link, useSearchParams } from 'react-router';

import type { TagWithCount, TicketStatus } from '@front-desk/contract';

import { useApi } from '../use-api.ts';
import { listTags } from './tags-api.ts';

export function TagSidebar({ status }: { status?: TicketStatus }) {
  const { data: tags = [] } = useApi<TagWithCount[]>(
    () => listTags(status),
    `tags:${status ?? 'all'}`,
  );
  const [params] = useSearchParams();
  const active = params.get('tag');

  return (
    <nav aria-label="Tags" className="sidebar-section">
      <h2>Tags</h2>
      <ul>
        {tags.map((tag) => {
          const next = new URLSearchParams(params);
          next.set('tag', tag.name);
          return (
            <li key={tag.id}>
              <Link
                to={`/?${next.toString()}`}
                className={active === tag.name ? 'active' : undefined}
              >
                <span className="tag-dot" style={{ background: tag.color }} />
                {tag.name} <span className="tag-count">{tag.ticketCount}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
