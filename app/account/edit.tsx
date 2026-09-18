import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Chip } from '../../src/components/ui';
import { countAccountTransactions, deleteAccount, getAccount, saveAccount } from '../../src/db/queries';
import { CHART_COLORS, useTheme } from '../../src/theme';
import { ACCOUNT_GROUPS, type AccountGroup } from '../../src/types';
import { parseMoneyToSen, senToInput } from '../../src/utils/money';

export default function AccountEditScreen() {
  const p = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : undefined;

  const [name, setName] = useState('');
  const [grp, setGrp] = useState<AccountGroup>('bank');
  const [initial, setInitial] = useState('0.00');
  const [color, setColor] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getAccount(db, id).then((a) => {
      if (!a) return;
      setName(a.name);
      setGrp(a.grp);
      setInitial(senToInput(a.initial_sen));
      setColor(a.color);
      setArchived(!!a.archived);
    });
  }, [db, id]);

  const save = async () => {
    const initialSen = parseMoneyToSen(initial || '0');
    if (!name.trim()) return setError('Give the account a name.');
    if (initialSen === null) return setError('Starting balance must be a number, e.g. 150.00 or -200.00');
    await saveAccount(db, { name: name.trim(), grp, initial_sen: initialSen, color, archived: archived ? 1 : 0 }, id);
    router.back();
  };

  const remove = async () => {
    if (!id) return;
    const n = await countAccountTransactions(db, id);
    Alert.alert(
      'Delete account?',
      n > 0 ? `This also deletes ${n} record${n === 1 ? '' : 's'} linked to it. Archive it instead to keep history.` : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAccount(db, id);
            router.dismissTo('/accounts');
          },
        },
      ],
    );
  };

  const input = [styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.card }];

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Label p={p}>Name</Label>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Maybank Savings" placeholderTextColor={p.sub} style={input} />

      <Label p={p}>Group</Label>
      <View style={styles.wrap}>
        {ACCOUNT_GROUPS.map((g) => (
          <Chip key={g.key} label={g.label} active={g.key === grp} onPress={() => setGrp(g.key)} />
        ))}
      </View>

      <Label p={p}>Starting balance (RM)</Label>
      <TextInput value={initial} onChangeText={setInitial} keyboardType="numbers-and-punctuation" style={input} />
      <Text style={{ color: p.sub, fontSize: 12, marginTop: -8 }}>Use a negative number for a card balance you owe.</Text>

      <Label p={p}>Colour</Label>
      <View style={styles.wrap}>
        {CHART_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c === color ? null : c)}
            style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? p.text : 'transparent' }]}
            accessibilityLabel={`Colour ${c}`}
          />
        ))}
      </View>

      {id ? (
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.text }}>Archived</Text>
            <Text style={{ color: p.sub, fontSize: 12 }}>Hidden from lists and pickers; history is kept.</Text>
          </View>
          <Switch value={archived} onValueChange={setArchived} trackColor={{ true: p.red }} />
        </View>
      ) : null}

      {error ? <Text style={{ color: p.expense, fontWeight: '600' }}>{error}</Text> : null}

      <Pressable onPress={save} style={[styles.btn, { backgroundColor: p.red }]}>
        <Text style={{ color: p.onRed, fontWeight: '700', fontSize: 16 }}>Save</Text>
      </Pressable>
      {id ? (
        <Pressable onPress={remove} style={styles.btnPlain}>
          <Text style={{ color: p.expense, fontWeight: '600' }}>Delete account</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Label({ children, p }: { children: string; p: ReturnType<typeof useTheme> }) {
  return <Text style={{ color: p.sub, fontSize: 12, fontWeight: '700', marginBottom: -8 }}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: { alignItems: 'center', paddingVertical: 15, borderRadius: 12, marginTop: 8 },
  btnPlain: { alignItems: 'center', paddingVertical: 12 },
});
