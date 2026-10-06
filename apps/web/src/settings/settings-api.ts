import type { BusinessHours } from '@front-desk/contract';

import { apiRequest } from '../api-client.ts';

export function getBusinessHours(): Promise<BusinessHours> {
  return apiRequest<BusinessHours>('/settings/business-hours');
}

export function saveBusinessHours(settings: BusinessHours): Promise<BusinessHours> {
  return apiRequest<BusinessHours>('/settings/business-hours', { method: 'PUT', body: settings });
}
