import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerBalances } from '../hooks/useCustomerBalances';
import { answerSpazaIQQuestion } from '../services/assistant/assistantService';
import { SUGGESTED_QUESTIONS } from '../services/assistant/intentCatalog';

const STATUS_CONFIG = {
  good: { label: 'Good', color: '#0F9D58', bg: '#E7F6ED' },
  fair: { label: 'Fair', color: '#D97706', bg: '#FEF3E2' },
  at_risk: { label: 'At Risk', color: '#DC2626', bg: '#FDEAEA' },
};

const formatR = (n) => `R${Number(n).toLocaleString('en-ZA')}`;

// storeId would normally come from auth context / a store-selection screen
export default function CreditLedgerScreen({ storeId }) {
  const { customers, loading, error, confirmCredit } = useCustomerBalances(storeId);

  const [idModalVisible, setIdModalVisible] = useState(false);
  const [idNumber, setIdNumber] = useState('');
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [pendingAmount, setPendingAmount] = useState('');
  const [pendingDueDate, setPendingDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: 'welcome', role: 'assistant', text: 'Hi. Ask me about customer balances, overdue credit, or recording a credit sale.' },
  ]);

  const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);

  const openIdVerification = (customer) => {
    setActiveCustomer(customer);
    setIdModalVisible(true);
  };

  const handleVerifyAndAppend = async () => {
    if (idNumber.trim().length < 6) {
      Alert.alert('Invalid ID', 'Please enter a valid store-linked ID number.');
      return;
    }
    const amount = parseFloat(pendingAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter the credit amount for this sale.');
      return;
    }
    if (!pendingDueDate.trim()) {
      Alert.alert('Due date required', 'Please enter when this credit should be paid.');
      return;
    }

    setSaving(true);
    try {
      await confirmCredit({
        idNumber,
        customer: activeCustomer,
        amount,
        dueDate: pendingDueDate.trim(),
      });
      setIdModalVisible(false);
      setIdNumber('');
      setPendingAmount('');
      setPendingDueDate('');
      setActiveCustomer(null);
    } catch (err) {
      Alert.alert('Could not log credit', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChatSubmit = async (suggestedQuestion = chatInput) => {
    const question = suggestedQuestion.trim();
    if (!question) return;

    setChatError('');
    setChatInput('');
    setChatMessages((messages) => [...messages, { id: `question-${Date.now()}`, role: 'user', text: question }]);
    setChatLoading(true);
    try {
      const result = await answerSpazaIQQuestion({ message: question, storeId });
      setChatMessages((messages) => [...messages, { id: `answer-${Date.now()}`, role: 'assistant', text: result.response }]);
    } catch (err) {
      setChatError(err.message || 'The assistant could not answer that question.');
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color="#0F9D58" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Text style={styles.errorText}>Couldn't load your credit ledger.</Text>
        <Text style={styles.errorSubtext}>{error.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Credit Ledger</Text>
        <Text style={styles.subtitle}>Track informal credit & customer logs</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Outstanding Credit</Text>
          <Text style={styles.totalAmount}>{formatR(totalOutstanding)}</Text>
          <View style={styles.totalFooterRow}>
            <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
            <Text style={styles.totalFooterText}>
              Spread across {customers.length} customers
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>CUSTOMER BALANCES</Text>

        {customers.length === 0 && (
          <Text style={styles.emptyText}>No customers on credit yet.</Text>
        )}

        {customers.map((customer) => {
          const status = STATUS_CONFIG[customer.status] ?? STATUS_CONFIG.good;
          return (
            <TouchableOpacity
              key={customer.id}
              style={styles.customerCard}
              activeOpacity={0.85}
              onPress={() => openIdVerification(customer)}
            >
              <View>
                <Text style={styles.customerName}>{customer.name}</Text>
                <Text style={styles.customerDue}>
                  {customer.dueBy ? `Due by ${customer.dueBy}` : 'No due date set'}
                </Text>
              </View>
              <View style={styles.customerRight}>
                <Text style={styles.customerBalance}>{formatR(customer.balance)}</Text>
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                  <Text style={[styles.statusText, { color: status.color }]}>
                    {status.label}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.recordButton}
          activeOpacity={0.9}
          onPress={() => openIdVerification({ id: 'new', name: 'New Customer', balance: 0 })}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.recordButtonText}>Record New Credit</Text>
        </TouchableOpacity>

        <View style={styles.complianceRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#9CA3AF" />
          <Text style={styles.complianceText}>Complies with spaza privacy & consent laws</Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setChatVisible(true)}
        accessibilityLabel="Open credit assistant"
      >
        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={idModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Verify to log credit sale</Text>
            <Text style={styles.modalSubtitle}>
              Enter your store-linked ID number to confirm this credit sale for{' '}
              {activeCustomer?.name}.
            </Text>

            <Text style={styles.inputLabel}>Store Owner ID Number</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 9001015800083"
              keyboardType="number-pad"
              value={idNumber}
              onChangeText={setIdNumber}
              editable={!saving}
            />

            <Text style={styles.inputLabel}>Credit Amount (R)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 150"
              keyboardType="decimal-pad"
              value={pendingAmount}
              onChangeText={setPendingAmount}
              editable={!saving}
            />

            <Text style={styles.inputLabel}>Due Date</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="YYYY-MM-DD"
              value={pendingDueDate}
              onChangeText={setPendingDueDate}
              editable={!saving}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setIdModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleVerifyAndAppend}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Confirm & Log</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={chatVisible} transparent animationType="slide" onRequestClose={() => setChatVisible(false)}>
        <View style={styles.chatOverlay}>
          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <View>
                <Text style={styles.chatTitle}>Khaka Chat Bot</Text>
                <Text style={styles.chatSubtitle}>SpazaIQ business assistant</Text>
              </View>
              <View style={styles.chatHeaderActions}>
                <TouchableOpacity onPress={() => setChatMessages([])} accessibilityLabel="Clear conversation">
                  <Ionicons name="trash-outline" size={21} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChatVisible(false)} accessibilityLabel="Close credit assistant">
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.chatMessages} contentContainerStyle={styles.chatMessagesContent}>
              {chatMessages.map((message) => (
                <View
                  key={message.id}
                  style={[styles.chatBubble, message.role === 'user' && styles.chatBubbleUser]}
                >
                  <Text style={[styles.chatText, message.role === 'user' && styles.chatTextUser]}>
                    {message.text}
                  </Text>
                </View>
              ))}
              {chatLoading && <ActivityIndicator color={GREEN} style={styles.chatLoading} />}
            </ScrollView>

            {!!chatError && <Text style={styles.chatError}>{chatError}</Text>}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsRow}>
              {SUGGESTED_QUESTIONS.map((question) => (
                <TouchableOpacity
                  key={question}
                  style={styles.suggestionButton}
                  onPress={() => handleChatSubmit(question)}
                  disabled={chatLoading}
                >
                  <Text style={styles.suggestionText}>{question}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Ask about the ledger..."
                placeholderTextColor="#9CA3AF"
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={() => handleChatSubmit()}
                returnKeyType="send"
                editable={!chatLoading}
              />
              <TouchableOpacity style={styles.chatSendButton} onPress={() => handleChatSubmit()} disabled={chatLoading} accessibilityLabel="Send message">
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const GREEN = '#0F9D58';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  errorSubtext: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  container: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 4, marginBottom: 20 },
  totalCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, marginBottom: 22 },
  totalLabel: { fontSize: 14, color: '#6B7280', marginBottom: 6 },
  totalAmount: { fontSize: 32, fontWeight: '800', color: '#EF4444', marginBottom: 10 },
  totalFooterRow: { flexDirection: 'row', alignItems: 'center' },
  totalFooterText: { fontSize: 13, color: '#9CA3AF', marginLeft: 6 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginBottom: 12 },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  customerDue: { fontSize: 13, color: '#9CA3AF', marginTop: 3 },
  customerRight: { alignItems: 'flex-end' },
  customerBalance: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '700' },
  recordButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  recordButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginLeft: 8 },
  complianceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  complianceText: { fontSize: 12, color: '#9CA3AF', marginLeft: 6 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 18, lineHeight: 18 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
  },
  modalButtonRow: { flexDirection: 'row', marginTop: 4 },
  modalButton: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalButtonCancel: { backgroundColor: '#F3F4F6', marginRight: 10 },
  modalButtonCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalButtonConfirm: { backgroundColor: GREEN },
  modalButtonConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  chatOverlay: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.5)', justifyContent: 'flex-end' },
  chatCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '78%' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14 },
  chatHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chatTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  chatSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  chatMessages: { minHeight: 180 },
  chatMessagesContent: { paddingVertical: 8 },
  chatLoading: { marginVertical: 8 },
  chatError: { color: '#B42318', fontSize: 12, marginBottom: 8 },
  suggestionsRow: { marginVertical: 8 },
  suggestionButton: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 8, marginRight: 7 },
  suggestionText: { color: '#374151', fontSize: 12 },
  chatBubble: { alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 11, marginBottom: 8 },
  chatBubbleUser: { alignSelf: 'flex-end', backgroundColor: GREEN },
  chatText: { color: '#374151', fontSize: 14, lineHeight: 19 },
  chatTextUser: { color: '#FFFFFF' },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  chatInput: { flex: 1, height: 46, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, color: '#111827', marginRight: 8 },
  chatSendButton: { width: 46, height: 46, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
});