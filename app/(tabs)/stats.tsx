import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TxItem } from '../../src/components/TxItem';
import { Card, Empty, Money, PeriodSwitcher, SectionTitle, Segmented } from '../../src/components/ui';
import { getBudgets, getCategoryTotals, getPeriodTotals, getTransactions } from '../../src/db/queries';
import { useFocusQuery } from '../../src/hooks';
import { CHART_COLORS, useTheme } from '../../src/theme';
import type { CategoryType } from '../../src/types';
import { elapsedDays, MONTHS_SHORT, periodLabel, periodRange, shiftPeriod, type PeriodKind } from '../../src/utils/date';
import { formatRM } from '../../src/utils/money';

const PERIODS: { key: PeriodKind; label: string }[] = [
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Annually' },
];

const TYPES: { key: CategoryType; label: string }[] = [
  { key: 'expense', label: 'Expenses' },
  { key: 'income', label: 'Income' },
];

export default function StatsScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [type, setType] = useState<CategoryType>('expense');
  const [openCat, setOpenCat] = useState<number | null | undefined>(undefined);

  const range = periodRange(kind, anchor);
  const trendRange = useMemo(() => {
    const end = periodRange('month', anchor).end;
    const start = periodRange('month', shiftPeriod('month', anchor, -5)).start;
    return { start, end, days: 0 };
  }, [anchor]);

  const [catTotals] = useFocusQuery((db) => getCategoryTotals(db, type, range), [type, range.start, range.end]);
  const [periodSums] = useFocusQuery((db) => getPeriodTotals(db, range, 7), [range.start, range.end]);
  const [trend] = useFocusQuery((db) => getPeriodTotals(db, trendRange, 7), [trendRange.start]);
  const [budgets] = useFocusQuery((db) => getBudgets(db), []);
  const [expenseByCat] = useFocusQuery(
    (db) => (kind === 'month' ? getCategoryTotals(db, 'expense', range) : Promise.resolve([])),
    [kind, range.start],
  );
  const [drill] = useFocusQuery(
    (db) => (openCat === undefined ? Promise.resolve([]) : getTransactions(db, range, { categoryId: openCat, type })),
    [openCat, type, range.start, range.end],
  );

  const income = (periodSums ?? []).reduce((s, r) => s + r.income, 0);
  const expense = (periodSums ?? []).reduce((s, r) => s + r.expense, 0);
  const cats = catTotals ?? [];
  const total = cats.reduce((s, c) => s + c.total_sen, 0);
  const color = (i: number) => CHART_COLORS[i % CHART_COLORS.length];
  const days = Math.max(1, elapsedDays(range));

  const shift = (d: number) => {
    setAnchor((a) => shiftPeriod(kind, a, d));
    setOpenCat(undefined);
  };

  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = shiftPeriod('month', anchor, i - 5);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = trend?.find((r) => r.key === key);
    return [
      { value: (row?.income ?? 0) / 100, frontColor: p.income, spacing: 3, label: MONTHS_SHORT[d.getMonth()] },
      { value: (row?.expense ?? 0) / 100, frontColor: p.expense },
    ];
  }).flat();

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={[styles.header, { backgroundColor: p.header, paddingTop: insets.top + 6 }]}>
        <PeriodSwitcher label={periodLabel(kind, anchor)} onPrev={() => shift(-1)} onNext={() => shift(1)} />
        <Segmented options={PERIODS} value={kind} onChange={(k) => { setKind(k); setOpenCat(undefined); }} onRed />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Card style={{ gap: 10 }}>
          <View style={styles.statsRow}>
            <Stat label="Income" node={<Money sen={income} type="income" />} />
            <Stat label="Expenses" node={<Money sen={expense} type="expense" />} />
            <Stat label="Net" node={<Money sen={income - expense} />} />
          </View>
          <View style={styles.statsRow}>
            <Stat label="Avg spend / day" node={<Money sen={Math.round(expense / days)} />} />
            <Stat label="Savings rate" node={<Text style={{ color: p.text, fontWeight: '600' }}>{income > 0 ? `${Math.round(((income - expense) / income) * 100)}%` : '–'}</Text>} />
          </View>
        </Card>

        <Segmented options={TYPES} value={type} onChange={(t) => { setType(t); setOpenCat(undefined); }} />

        {cats.length === 0 ? (
          <Card>
            <Empty icon="pie-chart-outline" title={`No ${type === 'expense' ? 'expenses' : 'income'} in this period`} />
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
            <PieChart
              data={cats.map((c, i) => ({ value: c.total_sen, color: color(i) }))}
              donut
              radius={Math.min(110, width / 2 - 70)}
              innerRadius={Math.min(70, width / 2 - 110)}
              innerCircleColor={p.card}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: p.sub, fontSize: 12 }}>{type === 'expense' ? 'Spent' : 'Earned'}</Text>
                  <Text style={{ color: p.text, fontWeight: '700', fontSize: 15 }}>{formatRM(total)}</Text>
                </View>
              )}
            />
          </Card>
        )}

        {cats.length > 0 ? (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {cats.map((c, i) => {
              const pct = total ? (c.total_sen / total) * 100 : 0;
              const open = openCat === c.category_id;
              return (
                <View key={String(c.category_id)}>
                  <Pressable
                    onPress={() => setOpenCat(open ? undefined : c.category_id)}
                    style={[styles.catRow, { borderBottomColor: p.border }]}
                  >
                    <Text style={[styles.pct, { backgroundColor: color(i) }]}>{pct.toFixed(pct < 10 ? 1 : 0)}%</Text>
                    <Text style={{ fontSize: 18 }}>{c.icon}</Text>
                    <Text style={{ color: p.text, flex: 1 }} numberOfLines={1}>{c.name}</Text>
                    <Money sen={c.total_sen} />
                  </Pressable>
                  {open ? (drill ?? []).map((t) => <TxItem key={t.id} tx={t} showDate />) : null}
                </View>
              );
            })}
          </Card>
        ) : null}

        {kind === 'month' ? <BudgetCard budgets={budgets ?? []} spentByCat={expenseByCat ?? []} range={range} /> : null}

        <SectionTitle>Last 6 months</SectionTitle>
        <Card style={{ paddingLeft: 4, overflow: 'hidden' }}>
          <BarChart
            data={trendData}
            barWidth={Math.max(8, (width - 150) / 20)}
            spacing={Math.max(10, (width - 150) / 14)}
            initialSpacing={10}
            height={170}
            width={width - 110}
            noOfSections={4}
            barBorderRadius={3}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={p.border}
            rulesColor={p.border}
            yAxisTextStyle={{ color: p.sub, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: p.sub, fontSize: 10, width: 40, marginLeft: 8 }}
            yAxisLabelWidth={44}
            formatYLabel={(v: string) => {
              const n = Number(v);
              return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n));
            }}
            isAnimated
          />
          <View style={styles.legend}>
            <Legend color={p.income} label="Income" />
            <Legend color={p.expense} label="Expenses" />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function Stat({ label, node }: { label: string; node: React.ReactNode }) {
  const p = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: p.sub, fontSize: 12 }}>{label}</Text>
      {node}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const p = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: p.sub, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function BudgetCard({
  budgets,
  spentByCat,
  range,
}: {
  budgets: { category_id: number | null; amount_sen: number }[];
  spentByCat: { category_id: number | null; name: string; icon: string; total_sen: number }[];
  range: ReturnType<typeof periodRange>;
}) {
  const p = useTheme();
  const totalSpent = spentByCat.reduce((s, c) => s + c.total_sen, 0);
  const rows = budgets
    .map((b) => {
      const cat = spentByCat.find((c) => c.category_id === b.category_id);
      return {
        key: String(b.category_id),
        label: b.category_id === null ? 'Total budget' : cat ? `${cat.icon} ${cat.name}` : null,
        spent: b.category_id === null ? totalSpent : (cat?.total_sen ?? 0),
        budget: b.amount_sen,
        catId: b.category_id,
      };
    })
    .sort((a, b) => (a.catId === null ? -1 : b.catId === null ? 1 : b.spent / b.budget - a.spent / a.budget));

  const monthProgress = elapsedDays(range) / range.days;

  return (
    <>
      <SectionTitle
        right={
          <Pressable onPress={() => router.push('/budgets')} hitSlop={10}>
            <Text style={{ color: p.red, fontWeight: '600' }}>Edit</Text>
          </Pressable>
        }
      >
        Budget
      </SectionTitle>
      <Card style={{ gap: 14 }}>
        {rows.length === 0 ? (
          <Pressable onPress={() => router.push('/budgets')}>
            <Text style={{ color: p.sub }}>No budgets yet. Tap to set a monthly budget.</Text>
          </Pressable>
        ) : (
          rows.map((r) => {
            const ratio = r.budget ? r.spent / r.budget : 0;
            const over = ratio > 1;
            return (
              <View key={r.key} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.text, fontWeight: '600' }}>{r.label ?? 'Category (no spending yet)'}</Text>
                  <Text style={{ color: over ? p.expense : p.sub, fontSize: 12 }}>
                    {formatRM(r.spent)} / {formatRM(r.budget)}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: p.track }]}>
                  <View style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: over ? p.expense : ratio > monthProgress ? '#F29B38' : '#4CB782', height: '100%', borderRadius: 4 }} />
                  <View style={[styles.todayMark, { left: `${monthProgress * 100}%`, backgroundColor: p.text }]} />
                </View>
                <Text style={{ color: p.sub, fontSize: 11 }}>
                  {over ? `Over by ${formatRM(r.spent - r.budget)}` : `${formatRM(r.budget - r.spent)} left`}
                </Text>
              </View>
            );
          })
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pct: { color: '#fff', fontSize: 11, fontWeight: '700', minWidth: 44, textAlign: 'center', paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', paddingTop: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'visible' },
  todayMark: { position: 'absolute', top: -3, width: 2, height: 14, opacity: 0.5 },
});
