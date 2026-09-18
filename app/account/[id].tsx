import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { TxItem } from '../../src/components/TxItem';
import { Empty, Money } from '../../src/components/ui';
import { getAccount, getTransactions } from '../../src/db/queries';
import { useFocusQuery } from '../../src/hooks';
import { useTheme } from '../../src/theme';
import { formatRM } from '../../src/utils/money';

export default function AccountDetailScreen() {
  const p = useTheme();
  const nav = useNavigation();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [account] = useFocusQuery((db) => getAccount(db, id), [id]);
  const [txs] = useFocusQuery((db) => getTransactions(db, null, { accountId: id }), [id]);

  useLayoutEffect(() => {
    nav.setOptions({
      title: account?.name ?? 'Account',
      headerRight: () => (
        <Pressable onPress={() => router.push({ pathname: '/account/edit', params: { id: String(id) } })} hitSlop={12} accessibilityLabel="Edit account">
          <Ionicons name="create-outline" size={22} color={p.onRed} />
        </Pressable>
      ),
    });
  }, [nav, account?.name, id, p.onRed]);

  // Money in/out from this account's point of view (transfers count too).
  const flow = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of txs ?? []) {
      const incoming = t.type === 'income' || (t.type === 'transfer' && t.to_account_id === id);
      if (incoming) inflow += t.amount_sen;
      else outflow += t.amount_sen;
    }
    return { inflow, outflow };
  }, [txs, id]);

  return (
    <FlatList
      style={{ backgroundColor: p.bg }}
      data={txs ?? []}
      keyExtractor={(t) => String(t.id)}
      renderItem={({ item }) => <TxItem tx={item} showDate />}
      ListHeaderComponent={
        account ? (
          <View style={[styles.head, { backgroundColor: p.card, borderBottomColor: p.border }]}>
            <Text style={{ color: p.sub }}>Balance</Text>
            <Money sen={account.balance_sen} style={{ fontSize: 28, fontWeight: '800' }} />
            <Text style={{ color: p.sub, fontSize: 12, marginTop: 6 }}>
              Starting balance {formatRM(account.initial_sen)} · In {formatRM(flow.inflow)} · Out {formatRM(flow.outflow)}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={<Empty title="No records for this account yet" />}
      contentContainerStyle={{ paddingBottom: 40 }}
    />
  );
}

const styles = StyleSheet.create({
  head: { padding: 20, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
});
