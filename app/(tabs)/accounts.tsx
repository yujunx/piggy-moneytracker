import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ListRow, Money, SectionTitle } from '../../src/components/ui';
import { getAccounts } from '../../src/db/queries';
import { useFocusQuery } from '../../src/hooks';
import { useTheme } from '../../src/theme';
import { ACCOUNT_GROUPS } from '../../src/types';

const GROUP_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cash: 'cash-outline',
  bank: 'business-outline',
  ewallet: 'phone-portrait-outline',
  card: 'card-outline',
  savings: 'trending-up-outline',
  other: 'ellipse-outline',
};

export default function AccountsScreen() {
  const p = useTheme();
  const nav = useNavigation();
  const [accounts] = useFocusQuery((db) => getAccounts(db, true), []);

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable onPress={() => router.push('/account/edit')} hitSlop={12} style={{ marginRight: 16 }} accessibilityLabel="Add account">
          <Ionicons name="add" size={26} color={p.onRed} />
        </Pressable>
      ),
    });
  }, [nav, p.onRed]);

  const list = accounts ?? [];
  const assets = list.filter((a) => a.balance_sen > 0).reduce((s, a) => s + a.balance_sen, 0);
  const liabilities = list.filter((a) => a.balance_sen < 0).reduce((s, a) => s + a.balance_sen, 0);

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.summary, { backgroundColor: p.card, borderBottomColor: p.border }]}>
        <Cell label="Assets" node={<Money sen={assets} type="income" />} />
        <Cell label="Liabilities" node={<Money sen={liabilities} type="expense" />} />
        <Cell label="Total" node={<Money sen={assets + liabilities} />} />
      </View>

      {ACCOUNT_GROUPS.map((g) => {
        const items = list.filter((a) => a.grp === g.key && !a.archived);
        if (!items.length) return null;
        const sum = items.reduce((s, a) => s + a.balance_sen, 0);
        return (
          <View key={g.key}>
            <SectionTitle right={<Money sen={sum} style={{ fontSize: 12 }} />}>{g.label}</SectionTitle>
            {items.map((a) => (
              <ListRow
                key={a.id}
                left={<Ionicons name={GROUP_ICONS[a.grp]} size={22} color={a.color ?? p.sub} />}
                title={a.name}
                right={<Money sen={a.balance_sen} />}
                onPress={() => router.push({ pathname: '/account/[id]', params: { id: String(a.id) } })}
              />
            ))}
          </View>
        );
      })}
      {list.some((a) => a.archived) ? (
        <View style={{ opacity: 0.6 }}>
          <SectionTitle>Archived</SectionTitle>
          {list
            .filter((a) => a.archived)
            .map((a) => (
              <ListRow
                key={a.id}
                left={<Ionicons name="archive-outline" size={22} color={p.sub} />}
                title={a.name}
                right={<Money sen={a.balance_sen} />}
                onPress={() => router.push({ pathname: '/account/[id]', params: { id: String(a.id) } })}
              />
            ))}
        </View>
      ) : null}
      <Text style={{ color: p.sub, fontSize: 12, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 }}>
        Accounts with a negative balance (like credit cards you owe on) count as liabilities.
      </Text>
    </ScrollView>
  );
}

function Cell({ label, node }: { label: string; node: React.ReactNode }) {
  const p = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: p.sub, fontSize: 12 }}>{label}</Text>
      {node}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
