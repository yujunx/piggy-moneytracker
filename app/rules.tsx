import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, Text } from 'react-native';
import { Empty, ListRow } from '../src/components/ui';
import { deleteMerchantRule, getMerchantRules } from '../src/db/queries';
import { useFocusQuery } from '../src/hooks';
import { useTheme } from '../src/theme';

export default function RulesScreen() {
  const p = useTheme();
  const db = useSQLiteContext();
  const [rules, reload] = useFocusQuery((d) => getMerchantRules(d), []);

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={{ color: p.sub, padding: 16 }}>
        When you change the category of a scanned record, Piggy remembers the merchant and uses your choice next time.
      </Text>
      {(rules ?? []).length === 0 ? <Empty icon="sparkles-outline" title="Nothing learned yet" /> : null}
      {(rules ?? []).map((r) => (
        <ListRow
          key={r.keyword}
          left={<Text style={{ fontSize: 20 }}>{r.category_icon}</Text>}
          title={`"${r.keyword}"`}
          subtitle={`→ ${r.category_name}`}
          right={
            <Pressable
              hitSlop={10}
              accessibilityLabel="Forget rule"
              onPress={async () => {
                await deleteMerchantRule(db, r.keyword);
                reload();
              }}
            >
              <Ionicons name="trash-outline" size={20} color={p.expense} />
            </Pressable>
          }
        />
      ))}
    </ScrollView>
  );
}
