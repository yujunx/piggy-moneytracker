import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { amountColor, useTheme } from '../theme';
import type { TxType } from '../types';
import { formatRM } from '../utils/money';

export function Money({ sen, type, style, sign }: { sen: number; type?: TxType; style?: StyleProp<TextStyle>; sign?: boolean }) {
  const p = useTheme();
  const color = type ? amountColor(p, type) : sen < 0 ? p.expense : p.text;
  return (
    <Text style={[{ color, fontVariant: ['tabular-nums'], fontWeight: '600' }, style]} numberOfLines={1}>
      {formatRM(sen, { sign })}
    </Text>
  );
}

export function PeriodSwitcher({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  const p = useTheme();
  return (
    <View style={styles.switcher}>
      <Pressable hitSlop={12} onPress={onPrev} accessibilityLabel="Previous">
        <Ionicons name="chevron-back" size={22} color={p.onRed} />
      </Pressable>
      <Text style={[styles.switcherLabel, { color: p.onRed }]}>{label}</Text>
      <Pressable hitSlop={12} onPress={onNext} accessibilityLabel="Next">
        <Ionicons name="chevron-forward" size={22} color={p.onRed} />
      </Pressable>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  onRed = false,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  onRed?: boolean;
}) {
  const p = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: onRed ? 'rgba(255,255,255,0.2)' : p.chip }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segmentItem, active && { backgroundColor: onRed ? p.onRed : p.card }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={{ color: active ? (onRed ? p.red : p.text) : onRed ? p.onRed : p.sub, fontWeight: '600', fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SummaryBar({ income, expense }: { income: number; expense: number }) {
  const p = useTheme();
  const cell = (label: string, node: ReactNode) => (
    <View style={styles.summaryCell}>
      <Text style={{ color: p.sub, fontSize: 12 }}>{label}</Text>
      {node}
    </View>
  );
  return (
    <View style={[styles.summary, { backgroundColor: p.card, borderColor: p.border }]}>
      {cell('Income', <Money sen={income} type="income" />)}
      {cell('Expenses', <Money sen={expense} type="expense" />)}
      {cell('Total', <Money sen={income - expense} />)}
    </View>
  );
}

export function Chip({ label, active, onPress, warn }: { label: string; active?: boolean; onPress?: () => void; warn?: boolean }) {
  const p = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? p.chipActive : p.chip, borderColor: active ? p.red : warn ? p.warnBorder : 'transparent' },
      ]}
    >
      <Text style={{ color: active ? p.red : p.text, fontWeight: active ? '700' : '500' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useTheme();
  return <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }, style]}>{children}</View>;
}

export function Empty({ icon = 'receipt-outline', title, hint }: { icon?: keyof typeof Ionicons.glyphMap; title: string; hint?: string }) {
  const p = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={p.sub} />
      <Text style={{ color: p.text, fontWeight: '600', marginTop: 8 }}>{title}</Text>
      {hint ? <Text style={{ color: p.sub, marginTop: 4, textAlign: 'center' }}>{hint}</Text> : null}
    </View>
  );
}

export function ListRow({
  left,
  title,
  subtitle,
  right,
  onPress,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const p = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? p.chip : p.card, borderBottomColor: p.border }]}
    >
      {left ? <View style={styles.rowLeft}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.text, fontSize: 15 }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: p.sub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  const p = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={{ color: p.sub, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 }}>{children.toUpperCase()}</Text>
      {right}
    </View>
  );
}

export function Fab({ icon, onPress, small, label, bottom }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; small?: boolean; label: string; bottom: number }) {
  const p = useTheme();
  const size = small ? 48 : 58;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        { bottom, width: size, height: size, borderRadius: size / 2, backgroundColor: small ? p.card : p.red, opacity: pressed ? 0.85 : 1, borderColor: p.border },
      ]}
    >
      <Ionicons name={icon} size={small ? 22 : 28} color={small ? p.red : p.onRed} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 6 },
  switcherLabel: { fontSize: 17, fontWeight: '700', minWidth: 130, textAlign: 'center' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  summary: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryCell: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, maxWidth: 200 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  rowLeft: { width: 34, alignItems: 'center' },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  fab: { position: 'absolute', right: 18, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, borderWidth: StyleSheet.hairlineWidth },
});
