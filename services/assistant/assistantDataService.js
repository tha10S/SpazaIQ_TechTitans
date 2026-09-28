import { fetchAssistantData } from '../firestore/assistantRepository';

export async function fetchSpazaIQData(storeId) {
  return fetchAssistantData(storeId);
}
