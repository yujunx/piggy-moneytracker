import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getAccounts, getCategories } from '../db/queries';
import { useFocusQuery } from '../hooks';
import { amountColor, useTheme } from '../theme';
import type { TxType } from '../types';
import { formatDateTime, fromDbDateTime, toDbDateTime } from '../utils/date';
import { formatRM, parseMoneyToSen, senToInput } from '../utils/money';
import { Chip, Segmented } from './ui';

export interface Draft {
  type: TxType;
  amount: string;
  accountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  datetime: string;
  note: string;
  memo: string;
  imageUri: string | null;
}

export interface ValidDraft extends Draft {
  amountSen: number;
  accountId: number;
}

/** Fields the scanner wasn't sure about get a yellow outline so the user checks them. */
export type UnsureFields = Partial<Record<'amount' | 'type' | 'date' | 'category' | 'account', boolean>>;

const TYPES: { key: TxType; label: string }[] = [
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expense' },
  { key: 'transfer', label: 'Transfer' },
];

export function RecordForm({
  initial,
  unsure = {},
  amountCandidates = [],
  header,
  footer,
  onChange,
  onSubmit,
  submitLabel = 'Save',
}: {
  initial: Draft;
  unsure?: UnsureFields;
  amountCandidates?: number[];
  header?: ReactNode;
  footer?: ReactNode;
  onChange?: (d: Draft) => void;
  onSubmit: (d: ValidDraft) => void;
  submitLabel?: string;
}) {
  const p = useTheme();
  const [draft, setDraft] = useState<Draft>(initial);
  const [touched, setTouched] = useState<UnsureFields>({});
  const [error, setError] = useState<string | null>(null);
  const [showIosPicker, setShowIosPicker] = useState(false);

  const [accounts] = useFocusQuery((db) => getAccounts(db), []);
  const [categories] = useFocusQuery((db) => getCategories(db), []);

  const update = (patch: Partial<Draft>, field?: keyof UnsureFields) => {
    const next = { ...draft, ...patch };
    // Switching between income/expense invalidates the category.
    if (patch.type && patch.type !== draft.type) next.categoryId = null;
    setDraft(next);
    setError(null);
    if (field) setTouched((t) => ({ ...t, [field]: true }));
    onChange?.(next);
  };

  const warn = (f: keyof UnsureFields) => !!unsure[f] && !touched[f];
  const warnStyle = (f: keyof UnsureFields) => (warn(f) ? { borderColor: p.warnBorder, backgroundColor: p.warnBg } : null);

  const pickDate = () => {
    const current = fromDbDateTime(draft.datetime);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onValueChange: (_, date) => {
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onValueChange: (__, time) => update({ datetime: toDbDateTime(time) }, 'date'),
            onDismiss: () => update({ datetime: toDbDateTime(date) }, 'date'),
          });
        },
      });
    } else {
      setShowIosPicker((s) => !s);
    }
  };

  const submit = () => {
    const amountSen = parseMoneyToSen(draft.amount);
    if (!amountSen || amountSen <= 0) return setError('Enter an amount greater than 0.');
    if (!draft.accountId) return setError('Choose an account.');
    if (draft.type === 'transfer') {
      if (!draft.toAccountId) return setError('Choose the account to transfer to.');
      if (draft.toAccountId === draft.accountId) return setError('Transfer needs two different accounts.');
    }
    onSubmit({ ...draft, amountSen, accountId: draft.accountId });
  };

  const cats = (categories ?? []).filter((c) => c.type === draft.type);
  const color = amountColor(p, draft.type);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }} keyboardShouldPersistTaps="handled">
      {header}

      <View style={[styles.box, warnStyle('type')]}>
        <Segmented options={TYPES} value={draft.type} onChange={(type) => update({ type }, 'type')} />
      </View>

      <Field label="Date" p={p}>
        <Pressable onPress={pickDate} style={[styles.input, { borderColor: p.border, backgroundColor: p.card }, warnStyle('date')]}>
          <Text style={{ color: p.text }}>{formatDateTime(draft.datetime)}</Text>
        </Pressable>
        {showIosPicker && Platform.OS === 'ios' ? (
          <DateTimePicker
            value={fromDbDateTime(draft.datetime)}
            mode="datetime"
            display="inline"
            onValueChange={(_, d) => update({ datetime: toDbDateTime(d) }, 'date')}
          />
        ) : null}
      </Field>

      <Field label="Amount (RM)" p={p}>
        <TextInput
          value={draft.amount}
          onChangeText={(amount) => update({ amount }, 'amount')}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={p.sub}
          style={[styles.input, styles.amount, { color, borderColor: p.border, backgroundColor: p.card }, warnStyle('amount')]}
        />
        {amountCandidates.length > 0 ? (
          <View style={styles.wrap}>
            <Text style={{ color: p.sub, fontSize: 12, alignSelf: 'center' }}>Other amounts found:</Text>
            {amountCandidates.map((sen) => (
              <Chip key={sen} label={formatRM(sen)} onPress={() => update({ amount: senToInput(sen) }, 'amount')} />
            ))}
          </View>
        ) : null}
      </Field>

      <Field label={draft.type === 'transfer' ? 'From account' : 'Account'} p={p}>
        <View style={[styles.wrap, styles.box, warnStyle('account')]}>
          {(accounts ?? []).map((a) => (
            <Chip key={a.id} label={a.name} active={a.id === draft.accountId} onPress={() => update({ accountId: a.id }, 'account')} />
          ))}
        </View>
      </Field>

      {draft.type === 'transfer' ? (
        <Field label="To account" p={p}>
          <View style={styles.wrap}>
            {(accounts ?? [])
              .filter((a) => a.id !== draft.accountId)
              .map((a) => (
                <Chip key={a.id} label={a.name} active={a.id === draft.toAccountId} onPress={() => update({ toAccountId: a.id })} />
              ))}
          </View>
        </Field>
      ) : (
        <Field label="Category" p={p}>
          <View style={[styles.wrap, styles.box, warnStyle('category')]}>
            {cats.map((c) => (
              <Chip key={c.id} label={`${c.icon} ${c.name}`} active={c.id === draft.categoryId} onPress={() => update({ categoryId: c.id }, 'category')} />
            ))}
          </View>
        </Field>
      )}

      <Field label="Note" p={p}>
        <TextInput
          value={draft.note}
          onChangeText={(note) => update({ note })}
          placeholder="e.g. Nasi lemak, Grab to KLCC"
          placeholderTextColor={p.sub}
          style={[styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.card }]}
        />
      </Field>

      <Field label="Description" p={p}>
        <TextInput
          value={draft.memo}
          onChangeText={(memo) => update({ memo })}
          placeholder="Anything the screenshot doesn't say (who it was with, why…)"
          placeholderTextColor={p.sub}
          multiline
          style={[styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.card, minHeight: 72, textAlignVertical: 'top' }]}
        />
      </Field>

      {draft.imageUri ? (
        <View>
          <Image source={{ uri: draft.imageUri }} style={styles.image} resizeMode="contain" />
          <Pressable onPress={() => update({ imageUri: null })} style={styles.removeImage} accessibilityLabel="Remove image">
            <Ionicons name="close-circle" size={26} color={p.red} />
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={{ color: p.expense, fontWeight: '600' }}>{error}</Text> : null}

      <Pressable onPress={submit} style={({ pressed }) => [styles.submit, { backgroundColor: p.red, opacity: pressed ? 0.85 : 1 }]}>
        <Text style={{ color: p.onRed, fontWeight: '700', fontSize: 16 }}>{submitLabel}</Text>
      </Pressable>
      {footer}
    </ScrollView>
  );
}

function Field({ label, children, p }: { label: string; children: ReactNode; p: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: p.sub, fontSize: 12, fontWeight: '700' }}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  amount: { fontSize: 26, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  box: { borderWidth: 1.5, borderColor: 'transparent', borderRadius: 12, padding: 2 },
  image: { width: '100%', height: 260, borderRadius: 12, backgroundColor: '#0002' },
  removeImage: { position: 'absolute', top: 6, right: 6 },
  submit: { alignItems: 'center', paddingVertical: 15, borderRadius: 12, marginTop: 4 },
});
