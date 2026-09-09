// Router: sends calls to the mock backend or Supabase depending on config.
// Hooks/screens import from THIS file and never know which one is active.
import { USE_MOCK_BACKEND } from './config';

const impl = USE_MOCK_BACKEND
  ? require('./mock/mockCreditService')
  : require('./supabase/supabaseCreditService');

export const fetchCustomerBalances = impl.fetchCustomerBalances;
export const verifyStoreOwner = impl.verifyStoreOwner;
export const addCreditTransaction = impl.addCreditTransaction;
export const sendWhatsAppReminder = impl.sendWhatsAppReminder;