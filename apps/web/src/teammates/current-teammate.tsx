import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Teammate } from '@front-desk/contract';

import { useApi } from '../use-api.ts';
import { listTeammates } from './teammates-api.ts';

const STORAGE_KEY = 'front-desk:teammate';

interface CurrentTeammate {
  teammates: Teammate[];
  current: Teammate | null;
  setCurrentId: (id: number) => void;
}

const CurrentTeammateContext = createContext<CurrentTeammate>({
  teammates: [],
  current: null,
  setCurrentId: () => {},
});

function readStoredId(): number | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}

/**
 * There's no login. Whoever is at the desk picks their name from the header,
 * and replies go out under it.
 */
export function CurrentTeammateProvider({ children }: { children: ReactNode }) {
  const { data: teammates = [] } = useApi(listTeammates, 'teammates');
  const [currentId, setCurrentId] = useState<number | null>(readStoredId);

  useEffect(() => {
    if (currentId === null) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(currentId));
    } catch {
      // Storage can be unavailable; the choice just won't persist.
    }
  }, [currentId]);

  const current = teammates.find((t) => t.id === currentId) ?? teammates[0] ?? null;

  return (
    <CurrentTeammateContext.Provider value={{ teammates, current, setCurrentId }}>
      {children}
    </CurrentTeammateContext.Provider>
  );
}

export function useCurrentTeammate(): CurrentTeammate {
  return useContext(CurrentTeammateContext);
}

export function TeammateSwitcher() {
  const { teammates, current, setCurrentId } = useCurrentTeammate();
  return (
    <label className="teammate-switcher">
      Signed in as{' '}
      <select
        value={current?.id ?? ''}
        onChange={(event) => setCurrentId(Number(event.target.value))}
      >
        {teammates.map((teammate) => (
          <option key={teammate.id} value={teammate.id}>
            {teammate.name}
          </option>
        ))}
      </select>
    </label>
  );
}
