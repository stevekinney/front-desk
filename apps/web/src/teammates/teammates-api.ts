import type { Teammate } from '@front-desk/contract';

import { apiRequest } from '../api-client.ts';

export function listTeammates(): Promise<Teammate[]> {
  return apiRequest<Teammate[]>('/teammates');
}
