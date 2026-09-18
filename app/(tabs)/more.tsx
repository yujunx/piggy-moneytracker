import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, ScrollView, Text } from 'react-native';
import { ListRow, SectionTitle } from '../../src/components/ui';
import { exportAll, getTransactions, importAll, isBackup, toCsv } from '../../src/db/queries';
import { useTheme } from '../../src/theme';
import { dayKey } from '../../src/utils/date';

export default function MoreScreen() {
  const p = useTheme();
  const db = useSQLiteContext();
  const icon = (name: keyof typeof Ionicons.glyphMap) => <Ionicons name={name} size={22} color={p.red} />;
  const chevron = <Ionicons name="chevron-forward" size={18} color={p.sub} />;

  const share = async (name: string, content: string, mimeType: string) => {
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(content);
    if (!(await Sharing.isAvailableAsync())) return Alert.alert('Sharing is not available on this device.');
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
  };

  const exportJson = async () => {
    try {
      const backup = await exportAll(db);
      await share(`piggy-backup-${dayKey(new Date())}.json`, JSON.stringify(backup), 'application/json');
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const exportCsv = async () => {
    try {
      const rows = await getTransactions(db, null);
      await share(`piggy-records-${dayKey(new Date())}.csv`, toCsv(rows), 'text/csv');
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const restore = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    let backup: unknown;
    try {
      backup = JSON.parse(await new File(res.assets[0].uri).text());
    } catch {
      return Alert.alert("That file isn't a valid backup.");
    }
    if (!isBackup(backup)) return Alert.alert("That file isn't a Piggy backup.");
    const b = backup;
    Alert.alert(
      'Restore backup?',
      `This replaces ALL current data with ${b.data.transactions.length} records and ${b.data.accounts.length} accounts from ${b.exported_at.slice(0, 10)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              await importAll(db, b);
              Alert.alert('Backup restored.');
            } catch (e) {
              Alert.alert('Restore failed — your data was not changed.', String(e));
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <SectionTitle>Settings</SectionTitle>
      <ListRow left={icon('pricetags-outline')} title="Categories" right={chevron} onPress={() => router.push('/categories')} />
      <ListRow left={icon('speedometer-outline')} title="Budgets" right={chevron} onPress={() => router.push('/budgets')} />
      <ListRow
        left={icon('sparkles-outline')}
        title="Learned scan rules"
        subtitle="Merchants Piggy has learned to categorise"
        right={chevron}
        onPress={() => router.push('/scan-rules')}
      />

      <SectionTitle>Backup</SectionTitle>
      <ListRow left={icon('cloud-upload-outline')} title="Export backup (JSON)" subtitle="Save to Drive, email it to yourself, etc." onPress={exportJson} />
      <ListRow left={icon('cloud-download-outline')} title="Restore from backup" subtitle="Replaces all current data" onPress={restore} />
      <ListRow left={icon('grid-outline')} title="Export records (CSV)" subtitle="Open in Excel or Google Sheets" onPress={exportCsv} />

      <Text style={{ color: p.sub, fontSize: 12, textAlign: 'center', marginTop: 28, paddingHorizontal: 24 }}>
        🐷 Piggy keeps all data on this phone. Backups don't include attached screenshots.
      </Text>
    </ScrollView>
  );
}
