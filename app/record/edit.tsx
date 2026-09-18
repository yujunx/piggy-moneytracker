import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { RecordForm, type Draft, type ValidDraft } from '../../src/components/RecordForm';
import { deleteTransaction, getAccounts, getTransaction, saveTransaction } from '../../src/db/queries';
import { deleteImage } from '../../src/ocr/recognize';
import { useTheme } from '../../src/theme';
import { toDbDateTime } from '../../src/utils/date';
import { senToInput } from '../../src/utils/money';

export default function EditRecordScreen() {
  const p = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const id = params.id ? Number(params.id) : undefined;
  const [initial, setInitial] = useState<Draft | null>(null);
  const [source, setSource] = useState<'manual' | 'scan'>('manual');

  useEffect(() => {
    (async () => {
      if (id) {
        const t = await getTransaction(db, id);
        if (!t) return router.back();
        setSource(t.source);
        setInitial({
          type: t.type,
          amount: senToInput(t.amount_sen),
          accountId: t.account_id,
          toAccountId: t.to_account_id,
          categoryId: t.category_id,
          datetime: t.datetime,
          note: t.note,
          memo: t.memo,
          imageUri: t.image_uri,
        });
      } else {
        const accounts = await getAccounts(db);
        const now = new Date();
        // From the calendar view: use the tapped day with the current time.
        const datetime = params.date ? `${params.date} ${toDbDateTime(now).slice(11)}` : toDbDateTime(now);
        setInitial({
          type: 'expense',
          amount: '',
          accountId: accounts[0]?.id ?? null,
          toAccountId: null,
          categoryId: null,
          datetime,
          note: '',
          memo: '',
          imageUri: null,
        });
      }
    })();
  }, [db, id, params.date]);

  const save = async (d: ValidDraft) => {
    await saveTransaction(
      db,
      {
        type: d.type,
        amount_sen: d.amountSen,
        account_id: d.accountId,
        to_account_id: d.toAccountId,
        category_id: d.categoryId,
        datetime: d.datetime,
        note: d.note.trim(),
        memo: d.memo.trim(),
        image_uri: d.imageUri,
        source,
      },
      id,
    );
    // The user removed the attached screenshot — clean up the stored file.
    if (initial?.imageUri && initial.imageUri !== d.imageUri) deleteImage(initial.imageUri);
    router.back();
  };

  const remove = () => {
    if (!id) return;
    Alert.alert('Delete this record?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(db, id);
          deleteImage(initial?.imageUri ?? null);
          router.back();
        },
      },
    ]);
  };

  if (!initial) return null;
  return (
    <RecordForm
      initial={initial}
      onSubmit={save}
      footer={
        id ? (
          <Pressable onPress={remove} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: p.expense, fontWeight: '600' }}>Delete record</Text>
          </Pressable>
        ) : null
      }
    />
  );
}
