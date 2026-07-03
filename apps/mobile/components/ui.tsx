/** Tiny shared UI kit so screens read cleanly. */
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme } from '../constants/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.buttonText, variant === 'ghost' && { color: theme.colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
  },
  sectionTitle: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing(1),
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing(1.5),
    paddingHorizontal: theme.spacing(2),
    alignItems: 'center',
    flex: 1,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    color: '#0B0E1A',
    fontWeight: '800',
    fontSize: 15,
  },
  pill: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(1.5),
    alignItems: 'center',
    minWidth: 78,
  },
  pillValue: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  pillLabel: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
