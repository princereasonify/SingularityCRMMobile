import { apiClient } from './client';
import { Contact, ContactFilters, CreateContactRequest, PaginatedResult } from '../types';

export const contactsApi = {
  getAll: (filters?: ContactFilters) =>
    apiClient.get<PaginatedResult<Contact>>('/contacts', { params: filters }),
  getById: (id: number) => apiClient.get<Contact>(`/contacts/${id}`),
  create: (data: CreateContactRequest) => apiClient.post<Contact>('/contacts', data),
  update: (id: number, data: Partial<CreateContactRequest>) =>
    apiClient.put<Contact>(`/contacts/${id}`, data),
  getBySchool: (schoolId: number) =>
    apiClient.get<Contact[]>(`/contacts/school/${schoolId}`),
};
