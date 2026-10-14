import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useNetSplitStore } from '../store/useNetSplitStore';
import { darkTheme, lightTheme, typography, spacing, radii } from '../theme';

interface NativePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NativePickerModal: React.FC<NativePickerModalProps> = ({ visible, onClose }) => {
  const [exePath, setExePath] = useState('');
  const [appName, setAppName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const themeMode = useNetSplitStore((state) => state.themeMode);
  const addManualApp = useNetSplitStore((state) => state.addManualApp);
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const handleSubmit = async () => {
    if (!exePath.trim()) {
      setError('Executable path cannot be empty');
      return;
    }

    if (!exePath.toLowerCase().endsWith('.exe')) {
      setError('File must have a .exe extension');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const success = await addManualApp(exePath.trim(), appName.trim() || undefined);
    setIsSubmitting(false);

    if (success) {
      setExePath('');
      setAppName('');
      onClose();
    } else {
      setError('Could not access or verify the specified executable file.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.surfaceCard, borderColor: theme.borderStrong }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Add Executable to NetSplit</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select or enter the normalized absolute path of an application or game binary.
          </Text>

          {/* Form */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Executable Path (.exe)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: error ? theme.error : theme.border,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="C:\Games\Example\bin\game.exe"
              placeholderTextColor={theme.textTertiary}
              value={exePath}
              onChangeText={(text) => {
                setExePath(text);
                setError(null);
              }}
              autoFocus
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Friendly Name (Optional)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: theme.border,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="e.g. My Custom Game"
              placeholderTextColor={theme.textTertiary}
              value={appName}
              onChangeText={setAppName}
            />
          </View>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.errorSubtle }]}>
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceHover }]}
              onPress={onClose}
            >
              <Text style={[styles.btnText, { color: theme.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnPrimary,
                {
                  backgroundColor: theme.accent,
                  opacity: isSubmitting ? 0.6 : 1,
                },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={[styles.btnPrimaryText, { color: '#ffffff' }]}>
                {isSubmitting ? 'Verifying...' : 'Add Application'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: 440,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontFamily: typography.fontFamilyDisplay,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginBottom: 6,
  },
  input: {
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontFamily: typography.fontFamilyMono,
    fontSize: typography.sizes.xs,
  },
  errorBox: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  btnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginRight: 8,
  },
  btnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: radii.sm,
  },
  btnText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
  },
  btnPrimaryText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
