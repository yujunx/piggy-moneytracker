import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Loads data whenever the screen gains focus or deps change, so every tab reflects
 * records added or edited on other screens without a global store.
 */
export function useFocusQuery<T>(load: (db: SQLiteDatabase) => Promise<T>, deps: unknown[]): [T | undefined, () => void] {
  const db = useSQLiteContext();
  const [data, setData] = useState<T>();
  const [tick, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      load(db)
        .then((d) => alive && setData(d))
        .catch((e) => console.warn('query failed', e));
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, tick, ...deps]),
  );
  return [data, () => setTick((t) => t + 1)];
}
