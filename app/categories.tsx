import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Segmented } from '../src/components/ui';
import { deleteCategory, getCategories, moveCategory, saveCategory } from '../src/db/queries';
import { useFocusQuery } from '../src/hooks';
import { useTheme } from '../src/theme';
import type { Category, CategoryType } from '../src/types';

const EMOJIS = ['🍜', '☕', '🛒', '🚗', '⛽', '🛍️', '💡', '📺', '🎬', '💊', '📚', '🏠', '🎁', '✈️', '🐶', '👶', '💇', '🏋️', '📱', '🧾', '💼', '💵', '🎉', '↩️', '💰', '📈', '📦'];

export default function CategoriesScreen() {
  const p = useTheme();
  const db = useSQLiteContext();
  const [type, setType] = useState<CategoryType>('expense');
  const [cats, reload] = useFocusQuery((d) => getCategories(d, type), [type]);
  const [editing, setEditing] = useState<{ id?: number; name: string; icon: string } | null>(null);

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    await saveCategory(db, { name: editing.name.trim(), icon: editing.icon, type }, editing.id);
    setEditing(null);
    reload();
  };

  const remove = (c: Category) =>
    Alert.alert(`Delete "${c.name}"?`, 'Existing records keep their amounts but become Uncategorized.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCategory(db, c.id);
          reload();
        },
      },
    ]);

  const list = cats ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ padding: 16 }}>
        <Segmented
          options={[
            { key: 'expense', label: 'Expense' },
            { key: 'income', label: 'Income' },
          ]}
          value={type}
          onChange={setType}
        />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {list.map((c, i) => (
          <View key={c.id} style={[styles.row, { backgroundColor: p.card, borderBottomColor: p.border }]}>
            <Text style={{ fontSize: 22, width: 34 }}>{c.icon}</Text>
            <Pressable style={{ flex: 1 }} onPress={() => setEditing({ id: c.id, name: c.name, icon: c.icon })}>
              <Text style={{ color: p.text, fontSize: 15 }}>{c.name}</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={async () => { await moveCategory(db, list, i, -1); reload(); }} accessibilityLabel="Move up">
              <Ionicons name="chevron-up" size={20} color={i === 0 ? p.border : p.sub} />
            </Pressable>
            <Pressable hitSlop={8} onPress={async () => { await moveCategory(db, list, i, 1); reload(); }} accessibilityLabel="Move down">
              <Ionicons name="chevron-down" size={20} color={i === list.length - 1 ? p.border : p.sub} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => remove(c)} accessibilityLabel="Delete">
              <Ionicons name="trash-outline" size={20} color={p.expense} />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => setEditing({ name: '', icon: '📦' })} style={styles.add}>
          <Ionicons name="add-circle" size={22} color={p.red} />
          <Text style={{ color: p.red, fontWeight: '700' }}>Add category</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: p.card }]}>
            <Text style={{ color: p.text, fontWeight: '700', fontSize: 17 }}>{editing?.id ? 'Edit category' : 'New category'}</Text>
            <TextInput
              value={editing?.name ?? ''}
              onChangeText={(name) => setEditing((e) => (e ? { ...e, name } : e))}
              placeholder="Name"
              placeholderTextColor={p.sub}
              autoFocus
              style={[styles.input, { color: p.text, borderColor: p.border }]}
            />
            <View style={styles.emojis}>
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setEditing((x) => (x ? { ...x, icon: e } : x))}
                  style={[styles.emoji, { backgroundColor: editing?.icon === e ? p.chipActive : 'transparent' }]}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }}>
              <Pressable onPress={() => setEditing(null)}>
                <Text style={{ color: p.sub, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={save}>
                <Text style={{ color: p.red, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  add: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16 },
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 16, padding: 20, gap: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  emoji: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
});
