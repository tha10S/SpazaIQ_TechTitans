import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { answerSpazaIQQuestion } from '../services/assistant/assistantService';

const QUICK_PROMPTS = [
  'How much did I sell today?',
  'What stock is running low?',
  'Who owes me the most?',
  'What are my best sellers?',
  'How do I record a sale?',
];

const INITIAL_MESSAGES = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hi! I’m your SpazaIQ assistant. Ask about sales, stock, customer credit, or how to use the app. I’ll only use information available in your store records.',
    time: 'Ready when you are',
  },
];

function currentTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TechTitansAssistant({ storeId, userName, shopName }) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible) scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, thinking, visible]);

  useEffect(() => () => {
    Promise.resolve(Speech.stop()).catch(() => undefined);
  }, []);

  const stopSpeaking = () => {
    Promise.resolve(Speech.stop()).catch(() => undefined);
    setIsSpeaking(false);
  };

  const speakMessage = (text) => {
    if (!text) return;
    stopSpeaking();
    setIsSpeaking(true);
    try {
      Speech.speak(text, {
        language: 'en-ZA',
        rate: 0.92,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (error) {
      setIsSpeaking(false);
    }
  };

  const closeAssistant = () => {
    stopSpeaking();
    setVisible(false);
  };

  const sendMessage = async (prompt) => {
    const question = (typeof prompt === 'string' ? prompt : draft).trim();
    if (!question || thinking) return;

    setDraft('');
    setMessages((current) => [...current, {
      id: `user-${Date.now()}`,
      role: 'user',
      text: question,
      time: currentTime(),
    }]);
    setThinking(true);

    try {
      const result = await answerSpazaIQQuestion({
        message: question,
        storeId,
        userName,
        shopName,
      });
      const response = result.response;
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: response,
        time: currentTime(),
      }]);
      if (voiceRepliesEnabled) speakMessage(response);
    } catch (error) {
      const response = error.message || 'I could not answer that just now. Please try again.';
      setMessages((current) => [...current, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        text: response,
        time: currentTime(),
      }]);
      if (voiceRepliesEnabled) speakMessage(response);
    } finally {
      setThinking(false);
    }
  };

  const clearConversation = () => {
    stopSpeaking();
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Open SpazaIQ voice assistant"
        activeOpacity={0.86}
      >
        <Ionicons name="chatbubble-ellipses" size={23} color="#FFFFFF" />
        <View style={styles.fabStatus} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={closeAssistant}
        onDismiss={stopSpeaking}
      >
        <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={styles.keyboardLayer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.header}>
                <View style={styles.brandMark}>
                  <Ionicons name="sparkles" size={21} color="#FFFFFF" />
                </View>
                <View style={styles.headerCopy}>
                  <Text style={styles.title}>SpazaIQ Assistant</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {shopName ? `${shopName} · ` : ''}Sales, stock & credit
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.headerButton, voiceRepliesEnabled && styles.headerButtonActive]}
                  onPress={() => {
                    if (voiceRepliesEnabled) stopSpeaking();
                    setVoiceRepliesEnabled((enabled) => !enabled);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={voiceRepliesEnabled ? 'Turn off automatic voice replies' : 'Turn on automatic voice replies'}
                >
                  <Ionicons
                    name={voiceRepliesEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
                    size={19}
                    color={voiceRepliesEnabled ? '#087A50' : '#64748B'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={clearConversation}
                  accessibilityRole="button"
                  accessibilityLabel="Clear conversation"
                >
                  <Ionicons name="refresh-outline" size={19} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={closeAssistant}
                  accessibilityRole="button"
                  accessibilityLabel="Close assistant"
                >
                  <Ionicons name="close" size={22} color="#334155" />
                </TouchableOpacity>
              </View>

              <View style={styles.assistantStatus}>
                <View style={[styles.statusDot, isSpeaking && styles.statusDotSpeaking]} />
                <Text style={styles.statusText}>
                  {isSpeaking ? 'Reading the reply aloud' : voiceRepliesEnabled ? 'Voice replies on · Tap the speaker to replay' : 'Voice replies off · Tap a speaker to listen'}
                </Text>
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  return (
                    <View key={message.id} style={[styles.messageRow, isUser && styles.userRow]}>
                      {!isUser && (
                        <View style={styles.messageAvatar}>
                          <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                        </View>
                      )}
                      <View style={[styles.messageGroup, isUser && styles.userMessageGroup]}>
                        {!isUser && <Text style={styles.senderLabel}>SPAZAIQ</Text>}
                        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                          <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.text}</Text>
                        </View>
                        <View style={[styles.messageMeta, isUser && styles.userMessageMeta]}>
                          <Text style={styles.messageTime}>{message.time}</Text>
                          {!isUser && message.id !== 'welcome' && (
                            <TouchableOpacity
                              style={styles.readButton}
                              onPress={() => speakMessage(message.text)}
                              accessibilityRole="button"
                              accessibilityLabel="Read this answer aloud"
                            >
                              <Ionicons name="volume-high-outline" size={15} color="#087A50" />
                              <Text style={styles.readLabel}>Listen</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
                {thinking && (
                  <View style={styles.typingRow}>
                    <ActivityIndicator size="small" color="#087A50" />
                    <Text style={styles.typingText}>Checking your store information…</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.promptSection}>
                <Text style={styles.promptHeading}>TRY ASKING</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptList}>
                  {QUICK_PROMPTS.map((prompt) => (
                    <TouchableOpacity
                      key={prompt}
                      style={styles.promptChip}
                      onPress={() => sendMessage(prompt)}
                      disabled={thinking}
                      accessibilityRole="button"
                    >
                      <Text style={styles.promptText}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.composer}>
                <TextInput
                  style={styles.input}
                  placeholder="Ask about your shop or the app…"
                  placeholderTextColor="#94A3B8"
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={() => sendMessage()}
                  editable={!thinking}
                  returnKeyType="send"
                  accessibilityLabel="Message for SpazaIQ assistant"
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!draft.trim() || thinking) && styles.sendButtonDisabled]}
                  onPress={() => sendMessage()}
                  disabled={!draft.trim() || thinking}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                >
                  {thinking
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Ionicons name="arrow-up" size={21} color="#FFFFFF" />}
                </TouchableOpacity>
              </View>
              <Text style={styles.disclaimer}>Answers use connected store data. Unavailable information is identified rather than guessed.</Text>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 84,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#087A50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#052E20',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  fabStatus: {
    position: 'absolute',
    right: 3,
    top: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#86EFAC',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.48)', justifyContent: 'flex-end' },
  keyboardLayer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '94%',
    minHeight: '70%',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 9,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 11 },
  brandMark: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087A50', marginRight: 11 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800', color: '#102A22' },
  subtitle: { fontSize: 11, color: '#64748B', marginTop: 3 },
  headerButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F6', marginLeft: 5 },
  headerButtonActive: { backgroundColor: '#DCFCE7' },
  assistantStatus: { minHeight: 31, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, backgroundColor: '#ECFDF5', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D8F1E3' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A', marginRight: 7 },
  statusDotSpeaking: { backgroundColor: '#D97706' },
  statusText: { fontSize: 10, fontWeight: '600', color: '#166534' },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 15, paddingTop: 17, paddingBottom: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 15 },
  userRow: { justifyContent: 'flex-end' },
  messageAvatar: { width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087A50', marginRight: 7, marginBottom: 19 },
  messageGroup: { maxWidth: '84%' },
  userMessageGroup: { alignItems: 'flex-end' },
  senderLabel: { color: '#087A50', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4, marginLeft: 2 },
  bubble: { borderRadius: 17, paddingHorizontal: 13, paddingVertical: 10 },
  assistantBubble: { borderBottomLeftRadius: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EDE8' },
  userBubble: { borderBottomRightRadius: 5, backgroundColor: '#087A50' },
  messageText: { color: '#1F2937', fontSize: 13, lineHeight: 19 },
  userMessageText: { color: '#FFFFFF' },
  messageMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 2 },
  userMessageMeta: { justifyContent: 'flex-end' },
  messageTime: { color: '#94A3B8', fontSize: 9 },
  readButton: { flexDirection: 'row', alignItems: 'center', marginLeft: 11, paddingVertical: 3, paddingHorizontal: 5 },
  readLabel: { color: '#087A50', fontSize: 10, fontWeight: '700', marginLeft: 3 },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 38, paddingVertical: 8 },
  typingText: { color: '#64748B', fontSize: 11, marginLeft: 8 },
  promptSection: { paddingTop: 8, paddingBottom: 6, backgroundColor: '#F8FAFC' },
  promptHeading: { paddingHorizontal: 17, color: '#64748B', fontSize: 9, fontWeight: '800', letterSpacing: 0.9, marginBottom: 7 },
  promptList: { paddingHorizontal: 14, gap: 7 },
  promptChip: { borderRadius: 999, borderWidth: 1, borderColor: '#CDE8D8', backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingVertical: 8 },
  promptText: { color: '#166534', fontSize: 10, fontWeight: '700' },
  composer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 13, marginTop: 4, padding: 5, paddingLeft: 14, borderRadius: 18, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF' },
  input: { flex: 1, minHeight: 42, color: '#0F172A', fontSize: 13, paddingVertical: 8 },
  sendButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087A50' },
  sendButtonDisabled: { backgroundColor: '#94A3B8' },
  disclaimer: { paddingHorizontal: 19, paddingTop: 6, textAlign: 'center', color: '#94A3B8', fontSize: 9, lineHeight: 13 },
});
