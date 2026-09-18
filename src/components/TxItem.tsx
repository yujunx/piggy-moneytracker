import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../theme';
import type { TxRow } from '../types';
import { ListRow, Money } from './ui';

export function TxItem({ tx, showDate }: { tx: TxRow; showDate?: boolean }) {
  const p = useTheme();
  const isTransfer = tx.type === 'transfer';
  const title = tx.note || (isTransfer ? 'Transfer' : (tx.category_name ?? 'Uncategorized'));
  const account = isTransfer ? `${tx.account_name} → ${tx.to_account_name ?? '?'}` : tx.account_name;
  const parts = [showDate ? tx.datetime : tx.datetime.slice(11), isTransfer ? null : tx.category_name, account, tx.memo || null].filter(Boolean);
  return (
    <ListRow
      onPress={() => router.push({ pathname: '/record/edit', params: { id: String(tx.id) } })}
      left={
        isTransfer ? (
          <Ionicons name="swap-horizontal" size={22} color={p.transfer} />
        ) : (
          <Text style={{ fontSize: 22 }}>{tx.category_icon ?? '❔'}</Text>
        )
      }
      title={title}
      subtitle={parts.join(' · ') + (tx.source === 'scan' ? '  📷' : '')}
      right={<Money sen={tx.amount_sen} type={tx.type} />}
    />
  );
}
