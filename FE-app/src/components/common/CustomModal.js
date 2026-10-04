/**
 * src/components/common/CustomModal.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom Alert & Dialog Component đồng bộ với Design System của app.
 * Thay thế cho Alert.alert() mặc định của React Native.
 * 
 * Props:
 *   visible        (boolean)   - Hiển thị modal
 *   type           (string)    - 'info' | 'success' | 'warning' | 'error' | 'confirm'
 *   title          (string)    - Tiêu đề thông báo
 *   message        (string)    - Nội dung thông báo
 *   confirmText    (string)    - Nhãn nút xác nhận (default: "Đồng ý")
 *   cancelText     (string)    - Nhãn nút hủy (default: "Hủy")
 *   onConfirm      (func)      - Event khi nhấn nút đồng ý/xác nhận
 *   onCancel       (func)      - Event khi nhấn nút hủy / đóng modal
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const TYPE_CONFIG = {
  info: {
    icon: 'ℹ️',
    color: '#00BCD4',
    bg: '#E0F7FA',
  },
  success: {
    icon: '✅',
    color: '#43A047',
    bg: '#E8F5E9',
  },
  warning: {
    icon: '⚠️',
    color: '#FB8C00',
    bg: '#FFF3E0',
  },
  error: {
    icon: '🚨',
    color: '#E53935',
    bg: '#FFEBEE',
  },
  confirm: {
    icon: '❓',
    color: '#1565C0',
    bg: '#E3F2FD',
  },
};

const CustomModal = ({
  visible = false,
  type = 'info',
  title = '',
  message = '',
  confirmText = 'Đồng ý',
  cancelText = 'Hủy',
  onConfirm,
  onCancel,
}) => {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const isConfirmMode = type === 'confirm';

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel || onConfirm}
    >
      <TouchableWithoutFeedback onPress={onCancel || onConfirm}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.cardContainer}>
              {/* Icon Circle Header */}
              <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
                <Text style={styles.iconText}>{config.icon}</Text>
              </View>

              {/* Title & Message */}
              {!!title && <Text style={styles.title}>{title}</Text>}
              {!!message && <Text style={styles.message}>{message}</Text>}

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                {isConfirmMode && (
                  <TouchableOpacity
                    style={[styles.btn, styles.btnCancel]}
                    onPress={onCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.btnCancelText}>{cancelText}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnConfirm,
                    { backgroundColor: type === 'error' ? '#E53935' : '#1A2236' },
                    isConfirmMode ? { flex: 1 } : styles.btnFull,
                  ]}
                  onPress={onConfirm}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnConfirmText}>{confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 20, 33, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardContainer: {
    width: Math.min(width - 48, 360),
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#546E7A',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  btn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  btnCancel: {
    flex: 1,
    backgroundColor: '#F4F5F7',
    borderWidth: 1,
    borderColor: '#DDE3ED',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#546E7A',
  },
  btnConfirm: {
  },
  btnFull: { width: '100%' },
  btnConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default CustomModal;
