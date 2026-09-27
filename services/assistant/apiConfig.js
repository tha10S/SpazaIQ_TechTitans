const DEFAULT_SHARED_KEY = 'PASTE_YOUR_OPENAI_API_KEY_HERE';

export const SHARED_CHATBOT_API_KEY =
  (typeof process !== 'undefined' && process.env && (
    process.env.EXPO_PUBLIC_CHATBOT_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.CHATBOT_API_KEY
  )) ||
  DEFAULT_SHARED_KEY;

export function hasSharedChatbotApiKey() {
  return Boolean(
    SHARED_CHATBOT_API_KEY &&
    SHARED_CHATBOT_API_KEY !== DEFAULT_SHARED_KEY &&
    /^(sk-|sk-proj-)/.test(SHARED_CHATBOT_API_KEY)
  );
}
