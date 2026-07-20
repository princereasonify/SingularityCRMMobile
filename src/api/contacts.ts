import { apiClient } from './client';
import { Contact, CreateContactRequest } from '../types';

/**
 * There is no ContactsController. Contacts are served entirely by
 * SchoolsController, which declares exactly four school-scoped routes:
 *
 *   GET    /schools/{schoolId}/contacts   → ApiResponse<List<ContactListDto>>
 *   POST   /schools/{schoolId}/contacts   → ApiResponse<ContactDto>
 *   PUT    /schools/contacts/{contactId}  → ApiResponse<ContactDto>
 *   DELETE /schools/contacts/{contactId}  → ApiResponse<bool>
 *
 * This module previously exported five more methods — getAll (`/contacts`),
 * getById (`/contacts/{id}`), create (`/contacts`), update (`/contacts/{id}`)
 * and checkDuplicates (`/contacts/check-duplicates`). None of those routes exist
 * in any controller, so every one was a guaranteed 404 (the same trap
 * `routePlan.ts` and `reports.ts` had). They are removed rather than left as
 * bait — add one back only together with its backend action.
 *
 * Because a contact can only be reached through its school, there is no
 * standalone contacts screen: web keeps contacts as a tab inside School Detail,
 * and mobile now mirrors that. The three files under `screens/contacts/` are
 * unreachable dead code kept only for reference.
 *
 * NB DELETE is role-gated server-side — SchoolsController.DeleteContact returns
 * Forbid() unless the caller is SCA/SH/RH/ZH — and it soft-deletes
 * ("Contact deactivated"). Web hides the delete control for other roles; so do we.
 */
export const contactsApi = {
  getBySchool: (schoolId: number) =>
    apiClient.get<Contact[]>(`/schools/${schoolId}/contacts`),

  addToSchool: (schoolId: number, data: CreateContactRequest) =>
    apiClient.post<Contact>(`/schools/${schoolId}/contacts`, data),

  update: (contactId: number, data: Partial<CreateContactRequest>) =>
    apiClient.put<Contact>(`/schools/contacts/${contactId}`, data),

  remove: (contactId: number) =>
    apiClient.delete<boolean>(`/schools/contacts/${contactId}`),
};
