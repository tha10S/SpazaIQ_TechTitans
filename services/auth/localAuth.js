import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNTS_KEY = 'spazaiq_local_accounts_v1';

async function readAccounts() {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function createLocalAccount(account) {
  const accounts = await readAccounts();
  const existing = accounts.find((item) => item.email.toLowerCase() === account.email.toLowerCase());
  const nextAccount = { ...account, id: existing?.id || `account_${Date.now()}` };
  const nextAccounts = existing
    ? accounts.map((item) => (item.id === existing.id ? nextAccount : item))
    : [...accounts, nextAccount];

  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts));
  return nextAccount;
}

export async function loginLocalAccount(identifier, pin) {
  const accounts = await readAccounts();
  const normalizedIdentifier = identifier.trim().toLowerCase();
  return accounts.find((account) => (
    [account.email, account.mobile, account.fullName].some((value) => String(value).toLowerCase() === normalizedIdentifier)
    && account.pin === pin
  ));
}