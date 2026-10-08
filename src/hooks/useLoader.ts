import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { errorMessage } from '../api';

/** Loads data every time the screen comes into focus, with a manual reload for pull-to-refresh. */
export function useLoader<T>(fetcher: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (e) {
      setError(errorMessage(e, 'Could not load'));
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, setData, loading, error, setError, reload };
}
