import { Link, useSearchParams } from 'react-router';

import type { Tag } from '@front-desk/contract';

import { useApi } from '../use-api.ts';
import { listTags } from './tags-api.ts';

export function TagSidebar() {
  const { data: tags = [] } = useApi<Tag[]>(listTags, 'tags');
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
                {tag.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
