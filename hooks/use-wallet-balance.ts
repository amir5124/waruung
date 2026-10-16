// hooks/use-wallet-balance.ts
import { api } from '@/lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

type Options = {
    /** Interval polling dalam ms. Set 0 untuk disable polling. */
    pollInterval?: number;
    /** Aktif polling hanya saat app di foreground */
    pauseOnBackground?: boolean;
};

export function useWalletBalance(options: Options = {}) {
    const { pollInterval = 30_000, pauseOnBackground = true } = options;

    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const mountedRef = useRef(true);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Fetch balance ──
    const fetchBalance = useCallback(async () => {
        try {
            const wallet = await api.wallet.get();
            if (!mountedRef.current) return;

            setBalance(Number(wallet.balance ?? 0));
            setError(null);
            setLastUpdated(new Date());
        } catch (err: any) {
            if (!mountedRef.current) return;
            console.warn('[useWalletBalance] fetch error:', err.message);
            setError(err.message);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    // ── Initial fetch + polling ──
    useEffect(() => {
        mountedRef.current = true;
        fetchBalance();

        if (pollInterval > 0) {
            pollRef.current = setInterval(() => {
                fetchBalance();
            }, pollInterval);
        }

        return () => {
            mountedRef.current = false;
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [fetchBalance, pollInterval]);

    // ── Pause polling saat app di background (opsional) ──
    useEffect(() => {
        if (!pauseOnBackground || pollInterval <= 0) return;

        const sub = AppState.addEventListener(
            'change',
            (state: AppStateStatus) => {
                if (state === 'active') {
                    // Refresh langsung saat app kembali ke foreground
                    fetchBalance();

                    if (!pollRef.current) {
                        pollRef.current = setInterval(() => {
                            fetchBalance();
                        }, pollInterval);
                    }
                } else {
                    // Hentikan polling
                    if (pollRef.current) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                    }
                }
            }
        );

        return () => sub.remove();
    }, [fetchBalance, pollInterval, pauseOnBackground]);

    return {
        balance,
        loading,
        error,
        lastUpdated,
        refresh: fetchBalance,
    };
}