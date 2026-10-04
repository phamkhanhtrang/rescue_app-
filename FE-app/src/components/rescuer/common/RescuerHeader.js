/**
 * src/components/rescuer/common/RescuerHeader.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Header dùng chung cho RescuerStack.
 * Khác với CitizenStack: logo "THE SENTINEL" (all caps), có avatar tròn bên phải.
 *
 * Props:
 *   dark       - Nền tối (default: false)
 *   showBack   - Hiện nút back
 *   onBack     - Callback back
 *   liveMode   - Hiện badge "LIVE FEED" (default: false)
 *   showAvatar - Hiện avatar rescuer (default: true)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RCOLORS, RFONTS, RSPACING } from '../../../constants/rescuer/theme';

const RescuerHeader = ({
  dark = false,
  showBack = false,
  onBack,
  liveMode = false,
  showAvatar = true,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android' ? insets.top : 0;
  const navigation = useNavigation();
  const bg        = dark ? RCOLORS.bgDark   : RCOLORS.bgWhite;
  const textColor = dark ? RCOLORS.textWhite: RCOLORS.textPrimary;

  return (
    <>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
      <View style={[styles.container, { backgroundColor: bg, height: 56 + topInset, paddingTop: topInset }]}>

        {/* Left slot */}
        <View style={styles.leftSlot}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Text style={[styles.back, { color: textColor }]}>←</Text>
            </TouchableOpacity>
          ) : (
            /* Shield logo */
            <View style={styles.logoRow}>
              <View style={styles.shieldWrap}>
                <View style={[styles.shield, { backgroundColor: RCOLORS.primary }]}>
                  <Text style={styles.shieldTxt}>🛡</Text>
                </View>
              </View>
              <View>
                <Text style={[styles.brand, { color: dark ? RCOLORS.textWhite : RCOLORS.primary }]}>
                  THE SENTINEL
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Center: LIVE badge (when liveMode) */}
        {liveMode && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE FEED</Text>
          </View>
        )}

        {/* Right slot: signal + avatar */}
        <View style={styles.rightSlot}>
          {/* Signal bars */}
          <View style={styles.signalRow}>
            {[4, 8, 12].map((h, i) => (
              <View key={i} style={[styles.signalBar, { height: h }]} />
            ))}
          </View>

          {/* Avatar circle */}
          {showAvatar && (
            <TouchableOpacity 
              style={styles.avatar}
              onPress={() => navigation.navigate('RescuerProfileScreen')}
              activeOpacity={0.7}
            >
              <Text style={styles.avatarText}>R</Text>
            </TouchableOpacity>
          )}
        </View>

      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: RSPACING.base,
    borderBottomWidth: 0,
  },

  leftSlot: {
    flex: 1,
    alignItems: 'flex-start',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shieldWrap: {
    width: 28, height: 28,
    borderRadius: 6,
    overflow: 'hidden',
  },
  shield: {
    width: 28, height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldTxt: { fontSize: 14 },
  brand: {
    fontSize: RFONTS.sm,
    fontWeight: RFONTS.black,
    letterSpacing: 1.5,
  },
  back: {
    fontSize: RFONTS.lg,
    fontWeight: RFONTS.bold,
  },

  // Live badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: RCOLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  liveDot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  liveText: {
    color: '#FFF',
    fontSize: RFONTS.xs,
    fontWeight: RFONTS.black,
    letterSpacing: 0.8,
  },

  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RSPACING.sm,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  signalBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: RCOLORS.statusGreen,
  },
  avatar: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: RCOLORS.bgNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: RCOLORS.textWhite,
    fontSize: RFONTS.sm,
    fontWeight: RFONTS.bold,
  },
});

export default RescuerHeader;
