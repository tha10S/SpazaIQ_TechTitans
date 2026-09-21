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
import { useNavigation } from '@react-navigation/native';
import { answerSpazaIQQuestion } from '../services/assistant/assistantService';

const INITIAL_MESSAGES = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hi, I am the Tech Titans Chat Bot. Ask me about your sales, stock, suppliers, credit, or insights.',
    time: '',
  },
];

function currentTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatbotScreen({ storeId }) {
  const navigation = useNavigation();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, isThinking]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || isThinking) return;

    setDraft('');
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', text, time: currentTime() },
    ]);
    setIsThinking(true);

    try {
      const result = await answerSpazaIQQuestion({ message: text, storeId });
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: result.response,
          time: currentTime(),
        },
      ]);
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
          <View style={styles.avatar}>
            <Ionicons name="chatbubble-outline" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Tech Titans Chat Bot</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.status}>Always Online</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Close assistant"
          >
            <Ionicons name="close" size={22} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
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
            onSubmitEditing={sendMessage}
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
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A86B',
  },
  headerCopy: { flex: 1, marginLeft: 14 },
  title: { color: '#172033', fontSize: 18, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00A86B', marginRight: 6 },
  status: { color: '#00A86B', fontSize: 14 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  messages: { flex: 1 },
  messagesContent: { padding: 20, paddingBottom: 28 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 22 },
  userRow: { justifyContent: 'flex-end' },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A86B',
    marginRight: 10,
  },
  bubble: { maxWidth: '78%', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16 },
  assistantBubble: { backgroundColor: '#DFF5ED', borderBottomLeftRadius: 5 },
  userBubble: { backgroundColor: '#F0F1F3', borderBottomRightRadius: 5 },
  messageText: { color: '#172033', fontSize: 16, lineHeight: 23 },
  userMessageText: { color: '#172033' },
  time: { color: '#00A86B', fontSize: 12, marginTop: 8 },
  userTime: { color: '#9CA3AF' },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    backgroundColor: '#DFF5ED',
  },
  typingText: { color: '#4B5563', fontSize: 13, marginLeft: 8 },
  composerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 18,
    color: '#172033',
    backgroundColor: '#F4F5F6',
    fontSize: 15,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    backgroundColor: '#00A86B',
  },
  sendButtonDisabled: { backgroundColor: '#A7DCC8' },
});