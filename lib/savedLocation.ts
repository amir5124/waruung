// lib/savedLocation.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'saved_location_v1';
const isWeb = Platform.OS === 'web';

// ============================================================
// TYPES
// ============================================================
export type LocationSource = 'gps' | 'search' | 'saved' | 'default';

export type SavedLocation = {
    latitude: number;
    longitude: number;
    label?: string | null;
    name?: string | null;
    address?: string | null;
    place_id?: string | null;
    source?: LocationSource;
    updatedAt?: number;
};

// ============================================================
// STORAGE — Web pakai localStorage, Native pakai SecureStore
// ============================================================
async function storageGet(key: string): Promise<string | null> {
    if (isWeb) {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string): Promise<void> {
    if (isWeb) {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, value);
        return;
    }
    await SecureStore.setItemAsync(key, value);
}

async function storageDelete(key: string): Promise<void> {
    if (isWeb) {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem(key);
        return;
    }
    await SecureStore.deleteItemAsync(key);
}

// ============================================================
// SAVE
// ============================================================
export async function saveLocation(
    loc: Omit<SavedLocation, 'updatedAt'>
): Promise<SavedLocation> {
    const saved: SavedLocation = {
        ...loc,
        updatedAt: Date.now(),
    };
    await storageSet(KEY, JSON.stringify(saved));
    return saved;
}

// ============================================================
// LOAD
// ============================================================
export async function loadSavedLocation(): Promise<SavedLocation | null> {
    try {
        const raw = await storageGet(KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);

        if (
            typeof parsed?.latitude === 'number' &&
            typeof parsed?.longitude === 'number' &&
            Number.isFinite(parsed.latitude) &&
            Number.isFinite(parsed.longitude)
        ) {
            return parsed as SavedLocation;
        }
        return null;
    } catch {
        return null;
    }
}

// ============================================================
// CLEAR
// ============================================================
export async function clearSavedLocation(): Promise<void> {
    await storageDelete(KEY);
}

// ============================================================
// HELPER — Partial update
// ============================================================
export async function updateSavedLocation(
    patch: Partial<SavedLocation>
): Promise<SavedLocation | null> {
    const current = await loadSavedLocation();
    if (!current) return null;

    const merged: SavedLocation = {
        ...current,
        ...patch,
        updatedAt: Date.now(),
    };
    await storageSet(KEY, JSON.stringify(merged));
    return merged;
}