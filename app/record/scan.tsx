import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RecordForm, type Draft, type UnsureFields, type ValidDraft } from '../../src/components/RecordForm';
import { Card } from '../../src/components/ui';
import { getAccounts, getCategories, getMerchantRules, saveMerchantRule, saveTransaction } from '../../src/db/queries';
import { merchantKeyword, parseReceipt, type ParseResult } from '../../src/ocr/parse';
import { deleteImage, OcrUnavailableError, persistImage, recognizeImage } from '../../src/ocr/recognize';
import { useTheme } from '../../src/theme';
import { toDbDateTime } from '../../src/utils/date';
import { senToInput } from '../../src/utils/money';

type Phase = 'pick' | 'reading' | 'review';

export default function ScanScreen() {
  const p = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ uri?: string }>();
  const [phase, setPhase] = useState<Phase>('pick');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [showText, setShowText] = useState(false);
  const [ocrMissing, setOcrMissing] = useState(false);
  const imageRef = useRef<string | null>(null);
  const savedRef = useRef(false);

  // Remove the stored copy of the screenshot if the user backs out without saving.
  useEffect(
    () => () => {
      if (!savedRef.current) deleteImage(imageRef.current);
    },
    [],
  );

  const process = async (pickedUri: string) => {
    setPhase('reading');
    try {
      deleteImage(imageRef.current);
      const uri = await persistImage(pickedUri);
      imageRef.current = uri;

      const [categories, accounts, rules] = await Promise.all([getCategories(db), getAccounts(db), getMerchantRules(db)]);
      let r: ParseResult | null = null;
      try {
        const lines = await recognizeImage(uri);
        r = parseReceipt(lines, { categories, accounts, learnedRules: rules });
      } catch (e) {
        if (!(e instanceof OcrUnavailableError)) throw e;
        setOcrMissing(true);
      }
      setResult(r);
      setDraft({
        type: r?.type ?? 'expense',
        amount: r?.amountSen ? senToInput(r.amountSen) : '',
        accountId: r?.accountId ?? accounts[0]?.id ?? null,
        toAccountId: null,
        categoryId: r?.categoryId ?? null,
        datetime: r?.datetime ?? toDbDateTime(new Date()),
        note: r?.merchant ?? '',
        memo: '',
        imageUri: uri,
      });
      setPhase('review');
    } catch (e) {
      Alert.alert("Couldn't read that image", String((e as Error)?.message ?? e));
      setPhase('pick');
    }
  };

  const pick = async (from: 'library' | 'camera') => {
    if (from === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Camera permission is needed to photograph a receipt.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) process(res.assets[0].uri);
  };

  // Allow opening this screen with an image already chosen (e.g. from a share intent).
  useEffect(() => {
    if (params.uri) process(params.uri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.uri]);

  const save = async (d: ValidDraft) => {
    await saveTransaction(db, {
      type: d.type,
      amount_sen: d.amountSen,
      account_id: d.accountId,
      to_account_id: d.toAccountId,
      category_id: d.categoryId,
      datetime: d.datetime,
      note: d.note.trim(),
      memo: d.memo.trim(),
      image_uri: d.imageUri,
      source: 'scan',
    });
    savedRef.current = true;
    if (d.imageUri !== imageRef.current) deleteImage(imageRef.current);

    // Learn: next time this merchant shows up, pre-pick the category the user chose.
    const merchant = result?.merchant || d.note.trim();
    const guessWasWrong = d.categoryId !== result?.categoryId || result?.categoryConfidence !== 'high';
    if (merchant && d.categoryId && d.type !== 'transfer' && guessWasWrong) {
      await saveMerchantRule(db, merchantKeyword(merchant), d.categoryId);
    }
    router.back();
  };

  if (phase === 'pick') {
    return (
      <View style={[styles.center, { backgroundColor: p.bg }]}>
        <Text style={[styles.title, { color: p.text }]}>Log a record from a screenshot</Text>
        <Text style={{ color: p.sub, textAlign: 'center', marginBottom: 24 }}>
          Works with receipts and TNG, GrabPay, ShopeePay, Boost, MAE or other banking app confirmations. Piggy reads the
          image on your phone, so nothing is uploaded.
        </Text>
        <BigButton icon="images-outline" label="Choose screenshot" onPress={() => pick('library')} primary />
        <BigButton icon="camera-outline" label="Photograph a receipt" onPress={() => pick('camera')} />
      </View>
    );
  }

  if (phase === 'reading' || !draft) {
    return (
      <View style={[styles.center, { backgroundColor: p.bg }]}>
        <ActivityIndicator size="large" color={p.red} />
        <Text style={{ color: p.sub, marginTop: 12 }}>Reading your screenshot…</Text>
      </View>
    );
  }

  const unsure: UnsureFields = result
    ? {
        amount: result.amountConfidence !== 'high',
        type: result.typeConfidence !== 'high',
        date: result.dateConfidence !== 'high',
        category: result.categoryConfidence !== 'high',
        account: !result.accountId,
      }
    : { amount: true, type: true, date: true, category: true, account: true };

  return (
    <RecordForm
      initial={draft}
      unsure={unsure}
      amountCandidates={result?.amountCandidates ?? []}
      submitLabel="Save record"
      onSubmit={save}
      header={
        <Card style={{ gap: 6 }}>
          {ocrMissing ? (
            <Text style={{ color: p.text }}>
              Text recognition isn't available in this build (it needs the Piggy dev build, not Expo Go). Fill in the details
              below; the screenshot will still be attached.
            </Text>
          ) : !result?.amountSen ? (
            <Text style={{ color: p.text }}>Couldn't find an amount in this image. Please fill it in below.</Text>
          ) : (
            <Text style={{ color: p.text }}>
              Check the details below. Fields with a <Text style={{ color: p.warnBorder, fontWeight: '700' }}>yellow outline</Text> are
              guesses. Add a description if the screenshot doesn't explain it.
            </Text>
          )}
          {result?.accountHint && !result.accountId ? (
            <Text style={{ color: p.sub, fontSize: 12 }}>
              Looks like a {result.accountHint} payment. Add an account with that name and future scans will pick it automatically.
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            <Pressable onPress={() => setPhase('pick')} hitSlop={8}>
              <Text style={{ color: p.red, fontWeight: '600' }}>Use another image</Text>
            </Pressable>
            {result?.text ? (
              <Pressable onPress={() => setShowText((s) => !s)} hitSlop={8}>
                <Text style={{ color: p.red, fontWeight: '600' }}>{showText ? 'Hide' : 'Show'} text found</Text>
              </Pressable>
            ) : null}
          </View>
          {showText ? (
            <Text selectable style={{ color: p.sub, fontSize: 12, fontFamily: 'monospace', marginTop: 6 }}>
              {result?.text}
            </Text>
          ) : null}
        </Card>
      }
    />
  );
}

function BigButton({ icon, label, onPress, primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean }) {
  const p = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        { backgroundColor: primary ? p.red : p.card, borderColor: p.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Ionicons name={icon} size={22} color={primary ? p.onRed : p.red} />
      <Text style={{ color: primary ? p.onRed : p.text, fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  big: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', paddingVertical: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
});
