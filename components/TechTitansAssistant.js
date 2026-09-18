import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { answerSpazaIQQuestion } from '../services/assistant/assistantService';

const welcomeMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi, I am the Tech Titans Chat Bot. Ask me about your sales, stock, suppliers, credit, or insights.',
};

export function TechTitansAssistant({ storeId, userName, shopName }) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [attachment, setAttachment] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, thinking]);

  const sendMessage = async () => {
    const question = draft.trim() || (attachment ? 'Analyse this screenshot and tell me what I should improve, including any visible sales or stock trends.' : '');
    if (!question || thinking) return;

    setDraft('');
    const selectedAttachment = attachment;
    setAttachment(null);
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text: question, imageUri: selectedAttachment?.uri }]);
    setThinking(true);

    try {
      const result = await answerSpazaIQQuestion({ message: question, storeId, userName, shopName, image: selectedAttachment });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: result.response }]);
    } catch (error) {
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', text: error.message }]);
    } finally {
      setThinking(false);
    }
  };

  const pickScreenshot = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]) {
      setAttachment(result.assets[0]);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setVisible(true)}
        accessibilityLabel="Open Tech Titans Chat Bot"
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={23} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Tech Titans Chat Bot</Text>
                <Text style={styles.subtitle}>SpazaIQ business assistant</Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)} accessibilityLabel="Close assistant">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
              {messages.map((message) => (
                <View key={message.id} style={[styles.bubble, message.role === 'user' && styles.userBubble]}>
                  {message.imageUri && <Image source={{ uri: message.imageUri }} style={styles.messageImage} />}
                  <Text style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>{message.text}</Text>
                </View>
              ))}
              {thinking && <ActivityIndicator color="#0F9D58" style={styles.loading} />}
            </ScrollView>

            {attachment && (
              <View style={styles.attachmentPreview}>
                <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
                <Text style={styles.attachmentText}>Screenshot ready for analysis</Text>
                <TouchableOpacity onPress={() => setAttachment(null)} accessibilityLabel="Remove screenshot">
                  <Ionicons name="close-circle" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.attachButton} onPress={pickScreenshot} disabled={thinking} accessibilityLabel="Upload screenshot">
                <Ionicons name="image-outline" size={21} color="#0F9D58" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Ask about your shop..."
                placeholderTextColor="#9CA3AF"
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendMessage}
                editable={!thinking}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendButton, (!draft.trim() && !attachment || thinking) && styles.disabledButton]}
                onPress={sendMessage}
                disabled={(!draft.trim() && !attachment) || thinking}
                accessibilityLabel="Send message"
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 18, bottom: 22, width: 54, height: 54, borderRadius: 27, backgroundColor: '#0F9D58', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  overlay: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  messages: { minHeight: 220 },
  messagesContent: { paddingVertical: 8 },
  bubble: { alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: '#E7F6ED', borderRadius: 14, padding: 12, marginBottom: 9 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#0F9D58' },
  messageText: { color: '#1F2937', fontSize: 14, lineHeight: 20 },
  userMessageText: { color: '#FFFFFF' },
  messageImage: { width: 190, height: 120, borderRadius: 9, marginBottom: 8 },
  loading: { marginVertical: 10 },
  attachmentPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 7, marginTop: 8 },
  previewImage: { width: 42, height: 42, borderRadius: 6, marginRight: 8 },
  attachmentText: { flex: 1, color: '#374151', fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  attachButton: { width: 42, height: 46, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  input: { flex: 1, height: 46, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, color: '#111827', marginRight: 8 },
  sendButton: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#0F9D58', alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.45 },
});