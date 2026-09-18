import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TxItem } from '../../src/components/TxItem';
import { Empty, Fab, Money, PeriodSwitcher, Segmented, SummaryBar } from '../../src/components/ui';
import { getPeriodTotals, getTransactions } from '../../src/db/queries';
import { useFocusQuery } from '../../src/hooks';
import { useTheme } from '../../src/theme';
import { dayKey, daysInMonth, MONTHS_SHORT, periodLabel, periodRange, shiftPeriod, WEEKDAYS_SHORT } from '../../src/utils/date';
import { formatRM } from '../../src/utils/money';
import { groupByDay, totals } from '../../src/utils/summary';

type Mode = 'daily' | 'calendar' | 'monthly';

const MODES: { key: Mode; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'monthly', label: 'Monthly' },
];

export default function TransactionsScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('daily');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date()));

  const periodKind = mode === 'monthly' ? 'year' : 'month';
  const range = periodRange(periodKind, anchor);

  const [txs] = useFocusQuery((db) => getTransactions(db, range), [range.start]);
  const [months] = useFocusQuery((db) => (mode === 'monthly' ? getPeriodTotals(db, range, 7) : Promise.resolve([])), [range.start, mode]);

  const sum = useMemo(() => totals(txs ?? []), [txs]);
  const days = useMemo(() => groupByDay(txs ?? []), [txs]);

  const shift = (delta: number) => setAnchor((a) => shiftPeriod(periodKind, a, delta));
  const addRecord = () =>
    router.push({ pathname: '/record/edit', params: mode === 'calendar' ? { date: selectedDay } : {} });

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={[styles.header, { backgroundColor: p.header, paddingTop: insets.top + 6 }]}>
        <PeriodSwitcher label={periodLabel(periodKind, anchor)} onPrev={() => shift(-1)} onNext={() => shift(1)} />
        <Segmented options={MODES} value={mode} onChange={setMode} onRed />
      </View>
      <SummaryBar income={sum.income} expense={sum.expense} />

      {mode === 'daily' ? (
        <SectionList
          sections={days.map((d) => ({ ...d, data: d.items }))}
          keyExtractor={(t) => String(t.id)}
          renderSectionHeader={({ section }) => <DayHeader day={section.day} income={section.income} expense={section.expense} />}
          renderItem={({ item }) => <TxItem tx={item} />}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 160 }}
          ListEmptyComponent={<Empty title="No records this month" hint="Tap + to add one, or the camera to scan a screenshot." />}
        />
      ) : mode === 'calendar' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
          <Calendar anchor={anchor} days={days} selected={selectedDay} onSelect={setSelectedDay} />
          {(days.find((d) => d.day === selectedDay)?.items ?? []).map((t) => (
            <TxItem key={t.id} tx={t} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
          {Array.from({ length: 12 }, (_, i) => 11 - i).map((m) => {
            const key = `${anchor.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
            const row = months?.find((x) => x.key === key);
            if (!row) return null;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setAnchor(new Date(anchor.getFullYear(), m, 1));
                  setMode('daily');
                }}
                style={[styles.monthRow, { backgroundColor: p.card, borderBottomColor: p.border }]}
              >
                <Text style={{ color: p.text, fontWeight: '700', width: 48 }}>{MONTHS_SHORT[m]}</Text>
                <Money sen={row.income} type="income" style={styles.monthCell} />
                <Money sen={row.expense} type="expense" style={styles.monthCell} />
                <Money sen={row.income - row.expense} style={styles.monthCell} />
              </Pressable>
            );
          })}
          {months && months.length === 0 ? <Empty title="No records this year" /> : null}
        </ScrollView>
      )}

      <Fab icon="camera" label="Scan a screenshot" small bottom={88} onPress={() => router.push('/record/scan')} />
      <Fab icon="add" label="Add record" bottom={20} onPress={addRecord} />
    </View>
  );
}

function DayHeader({ day, income, expense }: { day: string; income: number; expense: number }) {
  const p = useTheme();
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  return (
    <View style={[styles.dayHeader, { backgroundColor: p.card, borderBottomColor: p.border }]}>
      <Text style={{ color: p.text, fontSize: 22, fontWeight: '700', width: 36 }}>{d.getDate()}</Text>
      <Text style={[styles.weekday, { backgroundColor: d.getDay() === 0 ? p.red : d.getDay() === 6 ? p.income : p.sub }]}>
        {WEEKDAYS_SHORT[d.getDay()]}
      </Text>
      <View style={{ flex: 1 }} />
      <Money sen={income} type="income" style={{ width: 110, textAlign: 'right', fontSize: 13 }} />
      <Money sen={expense} type="expense" style={{ width: 110, textAlign: 'right', fontSize: 13 }} />
    </View>
  );
}

function Calendar({
  anchor,
  days,
  selected,
  onSelect,
}: {
  anchor: Date;
  days: { day: string; income: number; expense: number }[];
  selected: string;
  onSelect: (d: string) => void;
}) {
  const p = useTheme();
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const first = new Date(y, m, 1).getDay();
  const n = daysInMonth(y, m);
  const today = dayKey(new Date());
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const short = (sen: number) => formatRM(sen, { symbol: false }).replace(/\.00$/, '');

  return (
    <View style={{ backgroundColor: p.card }}>
      <View style={styles.calRow}>
        {WEEKDAYS_SHORT.map((w, i) => (
          <Text key={w} style={[styles.calHead, { color: i === 0 ? p.red : i === 6 ? p.income : p.sub }]}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.calRow}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (d == null) return <View key={i} style={[styles.calCell, { borderColor: p.border }]} />;
            const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const info = byDay.get(key);
            const isSel = key === selected;
            return (
              <Pressable
                key={i}
                onPress={() => onSelect(key)}
                style={[styles.calCell, { borderColor: p.border, backgroundColor: isSel ? p.chipActive : 'transparent' }]}
              >
                <Text style={{ color: key === today ? p.red : p.text, fontWeight: key === today ? '800' : '500', fontSize: 12 }}>{d}</Text>
                {info?.income ? <Text style={[styles.calAmt, { color: p.income }]} numberOfLines={1}>{short(info.income)}</Text> : null}
                {info?.expense ? <Text style={[styles.calAmt, { color: p.expense }]} numberOfLines={1}>{short(info.expense)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, marginTop: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  weekday: { color: '#fff', fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  monthCell: { flex: 1, textAlign: 'right', fontSize: 13 },
  calRow: { flexDirection: 'row' },
  calHead: { flex: 1, textAlign: 'center', paddingVertical: 6, fontSize: 12, fontWeight: '600' },
  calCell: { flex: 1, height: 58, borderTopWidth: StyleSheet.hairlineWidth, padding: 3 },
  calAmt: { fontSize: 9, fontWeight: '600' },
});
