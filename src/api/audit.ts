import { apiClient } from './client';
import { AuditLog, AuditFilters, PaginatedResult } from '../types';

export const auditApi = {
  getLogs: (filters?: AuditFilters) =>
    apiClient.get<PaginatedResult<AuditLog>>('/audit', { params: filters }),

  getEntityHistory: (entityType: string, entityId: number) =>
    apiClient.get<AuditLog[]>('/audit', {
      params: { entityType, entityId, pageSize: 50 },
    }),
};
