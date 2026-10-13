import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

export default function QRScannerScreen({
  visible = true,
  onClose,
  onScanned,
  navigation,
  route,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [manualError, setManualError] = useState('');
  const [cameraError, setCameraError] = useState('');
  // A ref blocks repeat scans straight away. State updates arrive too late when the camera fires many times a second.
  const scannedRef = useRef(false);
  const askedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      askedRef.current = false;
      setHasScanned(false);
      setManualError('');
      setManualValue('');
      setCameraError('');
    }
  }, [visible]);

  // Ask for camera access as soon as the scanner opens, so Expo Go shows its "Allow" prompt
  useEffect(() => {
    if (!visible || !permission || permission.granted || askedRef.current) return;
    if (permission.canAskAgain) {
      askedRef.current = true;
      requestPermission();
    }
  }, [visible, permission]);

  const closeScanner = () => {
    if (onClose) {
      onClose();
    } else {
      navigation.goBack();
    }
  };

  const returnScan = (value) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setHasScanned(true);
    if (onScanned) {
      onScanned(value);
    } else {
      navigation.navigate('MainTabs', {
        screen: route?.params?.returnTo || 'Home',
        params: { scannedCode: value },
      });
    }
  };

  const handleScan = ({ data }) => {
    const value = String(data ?? '').trim();
    if (value) returnScan(value);
  };

  const handleManualSubmit = () => {
    const value = manualValue.trim();
    if (!value) {
      setManualError('Enter a product barcode or QR value.');
      return;
    }
    if (value.length > 128) {
      setManualError('Barcode values must be 128 characters or fewer.');
      return;
    }
    setManualError('');
    returnScan(value);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeScanner}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan product barcode or QR code</Text>
          <TouchableOpacity onPress={closeScanner} accessibilityLabel="Close scanner">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.permissionPanel}>
            <Text style={styles.message}>Checking camera permission...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionPanel}>
            <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
            {permission.canAskAgain ? (
              <>
                <Text style={styles.message}>Camera access is needed to scan a product.</Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                  <Text style={styles.permissionButtonText}>Allow camera</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.message}>
                  Camera access is turned off. Open your phone settings, allow the camera for Expo Go, then come back.
                </Text>
                <TouchableOpacity style={styles.permissionButton} onPress={() => Linking.openSettings()}>
                  <Text style={styles.permissionButtonText}>Open settings</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
              }}
              onBarcodeScanned={hasScanned ? undefined : handleScan}
              onMountError={(event) => setCameraError(event?.message || 'The camera could not start.')}
            >
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.frame} />
                <Text style={styles.helper}>Point the camera at a product barcode or QR code</Text>
              </View>
            </CameraView>
            {cameraError ? <Text style={styles.cameraError}>{cameraError}</Text> : null}
          </View>
        )}

        <View style={styles.manualPanel}>
          <Text style={styles.manualTitle}>No camera? Type the barcode number</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="Example: 6009218004040"
              placeholderTextColor="#9CA3AF"
              value={manualValue}
              onChangeText={(value) => {
                setManualValue(value);
                setManualError('');
              }}
              maxLength={128}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!hasScanned}
              onSubmitEditing={handleManualSubmit}
            />
            <TouchableOpacity style={styles.manualButton} onPress={handleManualSubmit} disabled={hasScanned}>
              <Text style={styles.manualButtonText}>Use value</Text>
            </TouchableOpacity>
          </View>
          {manualError ? <Text accessibilityRole="alert" style={styles.error}>{manualError}</Text> : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  cameraWrap: { flex: 1 },
  camera: { flex: 1, alignSelf: 'stretch' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: '#0F9D58', borderRadius: 12 },
  helper: { color: '#FFFFFF', marginTop: 24, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
  cameraError: { color: '#FCA5A5', textAlign: 'center', padding: 12 },
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
  error: { color: '#FCA5A5', marginTop: 8 },
});