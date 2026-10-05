import React, { useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

export default function QRScannerScreen({ onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const handleScan = ({ data }) => {
    if (hasScanned) return;
    setHasScanned(true);
    onScanned(data);
  };

  const handleManualSubmit = () => {
    const value = manualValue.trim();
    if (!value) return;
    setHasScanned(true);
    onScanned(value);
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan product QR</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close scanner">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <Text style={styles.message}>Checking camera permission...</Text>
        ) : !permission.granted ? (
          <View style={styles.permissionPanel}>
            <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
            <Text style={styles.message}>Camera access is needed to scan a product.</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScan}
            />
            <View style={styles.frame} />
            <Text style={styles.helper}>Point the camera at a product QR code</Text>
          </View>
        )}

        <View style={styles.manualPanel}>
          <Text style={styles.manualTitle}>No camera? Enter the QR value</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="Example: p1"
              placeholderTextColor="#9CA3AF"
              value={manualValue}
              onChangeText={setManualValue}
              autoCapitalize="none"
              editable={!hasScanned}
              onSubmitEditing={handleManualSubmit}
            />
            <TouchableOpacity style={styles.manualButton} onPress={handleManualSubmit} disabled={hasScanned}>
              <Text style={styles.manualButtonText}>Use value</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  cameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: '#0F9D58', borderRadius: 12 },
  helper: { color: '#FFFFFF', marginTop: 280, fontSize: 15 },
  permissionPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  message: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', marginVertical: 16 },
  permissionButton: { backgroundColor: '#0F9D58', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 14 },
  permissionButtonText: { color: '#FFFFFF', fontWeight: '700' },
  manualPanel: { padding: 20, borderTopWidth: 1, borderTopColor: '#374151' },
  manualTitle: { color: '#D1D5DB', fontSize: 13, marginBottom: 8 },
  manualRow: { flexDirection: 'row', alignItems: 'center' },
  manualInput: { flex: 1, height: 46, backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, color: '#111827', marginRight: 8 },
  manualButton: { height: 46, backgroundColor: '#0F9D58', borderRadius: 10, justifyContent: 'center', paddingHorizontal: 14 },
  manualButtonText: { color: '#FFFFFF', fontWeight: '700' },
});