import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { answerSpazaIQQuestion } from '../services/assistant/assistantService';
import { fetchSpazaIQData } from '../services/assistant/assistantDataService';
import { buildDashboardSummary } from '../services/assistant/dashboardSummary';
import { USE_MOCK_BACKEND } from '../services/config';

const QUICK_PROMPTS = [
  'Who owes me the most?',
  'What are my best-selling products?',
  'How is my business doing?',
  'What should I restock?',
  'How much did I sell today?',
];

const INITIAL_MESSAGES = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hi! I’m SpazaIQ, your retail operations assistant. I can track sales, customer credit, stock priorities, and daily business performance in real time.',
    time: 'Now',
  },
];

function currentTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value) {
  return `R ${Number(value || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

export default function ChatbotScreen({ storeId, onClose }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);
  const scrollViewRef = useRef(null);

  const refreshDashboard = async () => {
    setDashboardLoading(true);
    setDashboardError(false);
    try {
      const data = await fetchSpazaIQData(storeId);
      setDashboard(buildDashboardSummary(data));
    } catch (error) {
      console.warn('Unable to load the store overview.', error);
      setDashboard(null);
      setDashboardError(true);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    refreshDashboard();
  }, [storeId]);

  useEffect(() => {
    if (messages.length > 1 || isThinking) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, isThinking]);

  useEffect(() => () => {
    try {
      Speech.stop();
    } catch (error) {
      // ignore speech cleanup errors on unmount
    }
  }, []);

  const speakReply = async (text) => {
    if (!voiceEnabled || !text || typeof Speech?.speak !== 'function') {
      setIsSpeaking(false);
      return;
    }

    try {
      if (typeof Speech.isSpeakingAsync === 'function') {
        const speaking = await Speech.isSpeakingAsync().catch(() => false);
        if (speaking) {
          Speech.stop();
        }
      }

      setIsSpeaking(true);
      Speech.speak(text, {
        language: 'en-ZA',
        rate: 0.92,
        pitch: 1,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => {
          setIsSpeaking(false);
          setVoiceEnabled(false);
        },
      });
    } catch (error) {
      console.warn('Text-to-speech not available on this device.', error);
      setIsSpeaking(false);
      setVoiceEnabled(false);
    }
  };

  const sendMessage = async (value) => {
    const text = (typeof value === 'string' ? value : draft).trim();
    if (!text || isThinking) return;

    setDraft('');
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', text, time: currentTime() },
    ]);
    setIsThinking(true);

    try {
      const result = await answerSpazaIQQuestion({ message: text, storeId });
      const assistantResponse = result.response;

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: assistantResponse,
          time: currentTime(),
        },
      ]);

      await speakReply(assistantResponse);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: error.message || 'I could not answer that right now. Please try again.',
          time: currentTime(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Ionicons name="sparkles" size={24} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>SpazaIQ Assistant</Text>
            <Text style={styles.subtitle}>Your business, at a glance</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, dashboardError && styles.statusDotError, isSpeaking && styles.statusDotSpeaking]} />
              <Text style={[styles.status, dashboardError && styles.statusError, isSpeaking && styles.statusSpeaking]}>
                {isSpeaking ? 'Speaking now' : dashboardError ? 'Store data unavailable' : dashboardLoading ? 'Loading store data' : USE_MOCK_BACKEND ? 'Demo data loaded' : 'Store data connected'}
              </Text>
            </View>
          </View>
          {!onClose && (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshDashboard}
              disabled={dashboardLoading}
              accessibilityLabel="Refresh store overview"
            >
              {dashboardLoading ? <ActivityIndicator size="small" color="#0F9D58" /> : <Ionicons name="refresh-outline" size={19} color="#475569" />}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.voiceButton}
            accessibilityLabel={voiceEnabled ? 'Disable voice responses' : 'Enable voice responses'}
            onPress={() => setVoiceEnabled((current) => !current)}
          >
            <Ionicons
              name={voiceEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
              size={20}
              color={voiceEnabled ? '#00A86B' : '#6B7280'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setMessages(INITIAL_MESSAGES)}
            disabled={isThinking}
            accessibilityLabel="Clear conversation"
          >
            <Ionicons name="trash-outline" size={19} color="#64748B" />
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={onClose}
              accessibilityLabel="Close assistant"
            >
              <Ionicons name="close" size={22} color="#475569" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={styles.conversationContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dashboardSection}>
            <View style={styles.salesHero}>
              <View style={styles.heroText}>
                <Text style={styles.heroEyebrow}>SALES THIS MONTH</Text>
                <Text style={styles.heroAmount}>
                  {dashboardLoading && !dashboard ? 'Loading…' : dashboardError ? 'Unavailable' : formatMoney(dashboard?.monthSalesTotal)}
                </Text>
                <Text style={styles.heroCaption}>
                  {dashboardError ? 'Check the connection and refresh' : `${dashboard?.monthSalesCount ?? 0} recorded sale${dashboard?.monthSalesCount === 1 ? '' : 's'} this month`}
                </Text>
              </View>
              <View style={styles.heroIcon}>
                <Ionicons name="storefront-outline" size={25} color="#D8FBE8" />
              </View>
              <View style={styles.heroGlow} />
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <View style={styles.metricIconCredit}><Ionicons name="wallet-outline" size={16} color="#B45309" /></View>
                <Text style={styles.metricLabel}>Credit outstanding</Text>
                <Text style={styles.metricValue} numberOfLines={1}>
                  {dashboardError ? 'Unavailable' : formatMoney(dashboard?.outstandingCredit)}
                </Text>
                <Text style={styles.metricDetail}>{dashboard?.creditAccountCount ?? 0} open accounts</Text>
              </View>
              <View style={styles.metricCard}>
                <View style={styles.metricIconProduct}><Ionicons name="star-outline" size={16} color="#1D4ED8" /></View>
                <Text style={styles.metricLabel}>Best seller</Text>
                <Text style={styles.metricValue} numberOfLines={1}>
                  {dashboard?.bestSeller?.name ?? (dashboardLoading ? 'Loading…' : 'No sales data')}
                </Text>
                <Text style={styles.metricDetail}>
                  {dashboard?.bestSeller ? `${dashboard.bestSeller.quantity} units sold` : 'Based on recorded sales'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.insightCard}
              onPress={() => sendMessage('Who owes me the most?')}
              disabled={isThinking || !dashboard?.priorityCustomer}
              activeOpacity={0.8}
            >
              <View style={styles.insightIcon}><Ionicons name="alert-circle-outline" size={20} color="#B45309" /></View>
              <View style={styles.insightCopy}>
                <Text style={styles.insightLabel}>PRIORITY FOLLOW-UP</Text>
                <Text style={styles.insightText} numberOfLines={2}>
                  {dashboard?.priorityCustomer
                    ? `${dashboard.priorityCustomer.name} has the largest balance at ${formatMoney(dashboard.priorityCustomer.balance)}.`
                    : dashboardLoading ? 'Checking customer balances…' : 'No outstanding customer balances to follow up.'}
                </Text>
              </View>
              {dashboard?.priorityCustomer && <Ionicons name="arrow-forward" size={16} color="#9A3412" />}
            </TouchableOpacity>
          </View>

          <View style={styles.promptSection}>
            <Text style={styles.eyebrow}>ASK YOUR ASSISTANT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptWrap}>
              {QUICK_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.quickPrompt}
                  onPress={() => sendMessage(prompt)}
                  disabled={isThinking}
                >
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <View key={message.id} style={[styles.messageRow, isUser && styles.userRow]}>
                {!isUser && (
                  <View style={styles.smallAvatar}>
                    <Ionicons name="chatbubble-outline" size={17} color="#FFFFFF" />
                  </View>
                )}
                <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                  <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.text}</Text>
                  <Text style={[styles.time, isUser && styles.userTime]}>{message.time}</Text>
                </View>
              </View>
            );
          })}
          {isThinking && (
            <View style={styles.messageRow}>
              <View style={styles.smallAvatar}>
                <Ionicons name="chatbubble-outline" size={17} color="#FFFFFF" />
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color="#00A86B" />
                <Text style={styles.typingText}>Assistant is typing...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.composerArea}>
          <TextInput
            style={styles.input}
            placeholder="Ask me anything..."
            placeholderTextColor="#9CA3AF"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            editable={!isThinking}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!draft.trim() || isThinking) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!draft.trim() || isThinking}
            accessibilityLabel="Send message"
          >
            <Ionicons name="send" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F7F5' },
  screen: { flex: 1, backgroundColor: '#F3F7F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5F0EA',
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 3px 12px rgba(15, 23, 42, 0.05)',
    elevation: 4,
  },
  avatarWrap: {
    paddingRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A86B',
    boxShadow: '0px 4px 8px rgba(0, 168, 107, 0.25)',
    elevation: 4,
  },
  headerCopy: { flex: 1 },
  title: { color: '#172033', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#64748B', fontSize: 12, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00A86B', marginRight: 6 },
  statusDotSpeaking: { backgroundColor: '#F59E0B' },
  statusDotError: { backgroundColor: '#DC2626' },
  status: { color: '#00A86B', fontSize: 12, fontWeight: '600' },
  statusSpeaking: { color: '#F59E0B' },
  statusError: { color: '#B91C1C' },
  refreshButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', marginRight: 7 },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF8F3',
    marginRight: 8,
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    marginRight: 7,
  },
  messages: { flex: 1, backgroundColor: '#F4F7F6' },
  conversationContent: { paddingBottom: 20 },
  dashboardSection: { paddingHorizontal: 16, paddingTop: 17, paddingBottom: 14 },
  eyebrow: { color: '#648074', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  salesHero: { minHeight: 118, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18, backgroundColor: '#102B23', borderRadius: 22, marginBottom: 11 },
  heroText: { zIndex: 2, flex: 1 },
  heroEyebrow: { color: '#A7D8BD', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  heroAmount: { color: '#FFFFFF', fontSize: 32, lineHeight: 38, fontWeight: '800', marginTop: 4 },
  heroCaption: { color: '#D1E4D8', fontSize: 12, marginTop: 3 },
  heroIcon: { zIndex: 2, width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#245640' },
  heroGlow: { position: 'absolute', width: 170, height: 170, right: 35, top: -112, borderRadius: 90, backgroundColor: '#1D4936', opacity: 0.85 },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 11 },
  metricCard: { flex: 1, minWidth: 0, minHeight: 112, padding: 13, borderRadius: 18, borderWidth: 1, borderColor: '#E7EEE9', backgroundColor: '#FFFFFF' },
  metricIconCredit: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4DB', marginBottom: 8 },
  metricIconProduct: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF1FF', marginBottom: 8 },
  metricLabel: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  metricValue: { color: '#172033', fontSize: 17, fontWeight: '800', marginTop: 3 },
  metricDetail: { color: '#94A3B8', fontSize: 10, marginTop: 3 },
  insightCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: '#F3DEB0', backgroundColor: '#FFFAEC' },
  insightIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0C2', marginRight: 10 },
  insightCopy: { flex: 1 },
  insightLabel: { color: '#A16207', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  insightText: { color: '#47351A', fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 3 },
  promptSection: { paddingTop: 2, paddingBottom: 6 },
  quickPromptWrap: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  quickPrompt: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CFEADA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    boxShadow: '0px 2px 5px rgba(15, 23, 42, 0.02)',
    elevation: 1,
  },
  quickPromptText: { color: '#0F172A', fontSize: 12, fontWeight: '700' },
  messagesContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18 },
  userRow: { justifyContent: 'flex-end' },
  smallAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A86B',
    marginRight: 8,
  },
  bubble: { maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 18 },
  assistantBubble: { backgroundColor: '#EAFBF4', borderBottomLeftRadius: 7 },
  userBubble: { backgroundColor: '#FFFFFF', borderBottomRightRadius: 7, borderWidth: 1, borderColor: '#E5E7EB' },
  messageText: { color: '#172033', fontSize: 15, lineHeight: 22 },
  userMessageText: { color: '#172033' },
  time: { color: '#00A86B', fontSize: 11, marginTop: 8, fontWeight: '600' },
  userTime: { color: '#94A3B8' },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    borderBottomLeftRadius: 7,
    backgroundColor: '#EAFBF4',
  },
  typingText: { color: '#4B5563', fontSize: 13, marginLeft: 8 },
  composerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    color: '#172033',
    backgroundColor: '#F4F7F6',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    backgroundColor: '#00A86B',
    boxShadow: '0px 4px 8px rgba(0, 168, 107, 0.2)',
    elevation: 3,
  },
  sendButtonDisabled: { backgroundColor: '#A7DCC8' },
});