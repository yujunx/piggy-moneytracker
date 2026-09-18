import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SectionTitle } from '../src/components/ui';
import { getBudgets, getCategories, setBudget } from '../src/db/queries';
import { useFocusQuery } from '../src/hooks';
import { useTheme } from '../src/theme';
import { parseMoneyToSen, senToInput } from '../src/utils/money';

/** Monthly budgets. Values save when a field loses focus; leave empty to remove. */
export default function BudgetsScreen() {
  const p = useTheme();
  const db = useSQLiteContext();
  const [cats] = useFocusQuery((d) => getCategories(d, 'expense'), []);
  const [budgets] = useFocusQuery((d) => getBudgets(d), []);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!budgets) return;
    setValues(Object.fromEntries(budgets.map((b) => [String(b.category_id), senToInput(b.amount_sen)])));
  }, [budgets]);

  const commit = async (catId: number | null) => {
    const raw = values[String(catId)] ?? '';
    const sen = raw.trim() ? parseMoneyToSen(raw) : null;
    await setBudget(db, catId, sen);
  };

  const row = (key: number | null, label: string) => (
    <View key={String(key)} style={[styles.row, { backgroundColor: p.card, borderBottomColor: p.border }]}>
      <Text style={{ color: p.text, flex: 1 }}>{label}</Text>
      <Text style={{ color: p.sub }}>RM</Text>
      <TextInput
        value={values[String(key)] ?? ''}
        onChangeText={(v) => setValues((s) => ({ ...s, [String(key)]: v }))}
        onEndEditing={() => commit(key)}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={p.sub}
        style={[styles.input, { color: p.text, borderColor: p.border }]}
      />
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: p.sub, padding: 16, paddingBottom: 0 }}>
        Budgets repeat every month. Progress shows on the Stats tab under Monthly.
      </Text>
      <SectionTitle>Overall</SectionTitle>
      {row(null, 'Total monthly spending')}
      <SectionTitle>By category</SectionTitle>
      {(cats ?? []).map((c) => row(c.id, `${c.icon} ${c.name}`))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { width: 110, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, textAlign: 'right' },
});
