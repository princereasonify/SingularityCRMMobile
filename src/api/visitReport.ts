import { apiClient } from './client';
import { CreateVisitReportRequest } from '../types';

export const visitReportApi = {
  create: (data: CreateVisitReportRequest) =>
    apiClient.post('/visit-reports', data),
  getByActivity: (activityId: number) =>
    apiClient.get(`/visit-reports/activity/${activityId}`),
  getBySchoolVisit: (visitLogId: number) =>
    apiClient.get(`/visit-reports/visit/${visitLogId}`),
};
