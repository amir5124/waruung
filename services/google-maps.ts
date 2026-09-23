import type { Coords, PlaceLoc, PlaceSuggestion, RouteInfo } from '@/types/ojek';
import * as Location from 'expo-location';

// Simpan di .env (root project):  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=xxxx
// Setelah mengubah .env, restart Metro:  npx expo start -c
// Key ini dipanggil lewat fetch, jadi JANGAN dibatasi ke "Android apps" (request akan ditolak).
// Batasi saja ke API yang dipakai. Key native peta (app.json) adalah key terpisah.
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? 'AIzaSyCxfdljVSgNFeQKfEzNzeUJUuJVxSxntVQ';

/**
 * 'legacy' -> "Places API" biasa   (aktifkan: Places API)
 * 'new'    -> "Places API (New)"   (aktifkan: Places API (New))
 * Geocoding API tetap dibutuhkan di kedua mode, Routes API untuk garis rute.
 */
const PLACES_MODE: 'legacy' | 'new' = 'legacy';

if (!API_KEY) {
    console.warn('[google-maps] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY kosong. Cek .env lalu jalankan: npx expo start -c');
}

async function warnResponse(tag: string, res: Response) {
    let detail = '';
    try {
        detail = await res.text();
    } catch { }
    console.warn(`[${tag}]`, res.status, detail);
}

const qs = (p: Record<string, string | number | undefined>) =>
    Object.entries(p)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&');

export const newSessionToken = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]*$/i;

/** "XQJH+PJP, Wrage, Tambahrejo, ..." -> "Wrage" */
export const shortName = (formatted: string) => {
    const parts = formatted.split(',').map((s) => s.trim());
    return parts.find((p) => p && !PLUS_CODE.test(p)) ?? parts[0] ?? '';
};

type AutocompleteOpts = { origin?: Coords; sessionToken: string; signal?: AbortSignal };

/* ------------------------------ Places API (legacy) ------------------------------ */

async function autocompleteLegacy(input: string, opts: AutocompleteOpts): Promise<PlaceSuggestion[]> {
    const o = opts.origin;
    const url =
        'https://maps.googleapis.com/maps/api/place/autocomplete/json?' +
        qs({
            input,
            key: API_KEY,
            language: 'id',
            components: 'country:id',
            sessiontoken: opts.sessionToken,
            location: o ? `${o.latitude},${o.longitude}` : undefined,
            radius: o ? 50000 : undefined,
            origin: o ? `${o.latitude},${o.longitude}` : undefined, // supaya distance_meters terisi
        });
    const res = await fetch(url, { signal: opts.signal });
    const data = await res.json();
    // API legacy membalas HTTP 200 walau ditolak; alasannya ada di field status
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn('[autocomplete]', data.status, data.error_message ?? '');
        throw new Error(`autocomplete ${data.status}`);
    }
    return (data.predictions ?? []).map((p: any) => {
        const f = p.structured_formatting;
        return {
            placeId: p.place_id,
            mainText: f?.main_text ?? p.description ?? '',
            secondaryText: f?.secondary_text ?? '',
            distanceMeters: p.distance_meters,
            matches: (f?.main_text_matched_substrings ?? []).map((m: any) => ({
                start: m.offset,
                end: m.offset + m.length,
            })),
        } as PlaceSuggestion;
    });
}

async function detailsLegacy(placeId: string, sessionToken: string): Promise<PlaceLoc> {
    const url =
        'https://maps.googleapis.com/maps/api/place/details/json?' +
        qs({
            place_id: placeId,
            fields: 'place_id,name,formatted_address,geometry/location',
            language: 'id',
            sessiontoken: sessionToken,
            key: API_KEY,
        });
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') {
        console.warn('[place-details]', data.status, data.error_message ?? '');
        throw new Error(`details ${data.status}`);
    }
    const r = data.result;
    return {
        placeId,
        name: r.name ?? shortName(r.formatted_address ?? ''),
        address: r.formatted_address ?? '',
        coords: { latitude: r.geometry.location.lat, longitude: r.geometry.location.lng },
    };
}

/* ------------------------------ Places API (New) ------------------------------ */

async function autocompleteNew(input: string, opts: AutocompleteOpts): Promise<PlaceSuggestion[]> {
    const body: Record<string, unknown> = {
        input,
        languageCode: 'id',
        regionCode: 'ID',
        includedRegionCodes: ['id'],
        sessionToken: opts.sessionToken,
    };
    if (opts.origin) {
        body.origin = opts.origin;
        body.locationBias = { circle: { center: opts.origin, radius: 50000 } };
    }
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        signal: opts.signal,
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        await warnResponse('autocomplete', res);
        throw new Error(`autocomplete ${res.status}`);
    }
    const data = await res.json();
    return (data.suggestions ?? [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => {
            const p = s.placePrediction;
            const main = p.structuredFormat?.mainText;
            return {
                placeId: p.placeId,
                mainText: main?.text ?? p.text?.text ?? '',
                secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
                distanceMeters: p.distanceMeters,
                matches: (main?.matches ?? []).map((m: any) => ({ start: m.startOffset ?? 0, end: m.endOffset })),
            } as PlaceSuggestion;
        });
}

async function detailsNew(placeId: string, sessionToken: string): Promise<PlaceLoc> {
    const res = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}?languageCode=id&sessionToken=${sessionToken}`,
        { headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': 'id,displayName,formattedAddress,location' } }
    );
    if (!res.ok) {
        await warnResponse('place-details', res);
        throw new Error(`details ${res.status}`);
    }
    const d = await res.json();
    return {
        placeId,
        name: d.displayName?.text ?? shortName(d.formattedAddress ?? ''),
        address: d.formattedAddress ?? '',
        coords: { latitude: d.location.latitude, longitude: d.location.longitude },
    };
}

/* ------------------------------ dipakai komponen ------------------------------ */

export const autocompletePlaces = (input: string, opts: AutocompleteOpts) =>
    PLACES_MODE === 'legacy' ? autocompleteLegacy(input, opts) : autocompleteNew(input, opts);

export const getPlaceDetails = (placeId: string, sessionToken: string) =>
    PLACES_MODE === 'legacy' ? detailsLegacy(placeId, sessionToken) : detailsNew(placeId, sessionToken);

export async function reverseGeocode(c: Coords): Promise<{ name: string; address: string }> {
    try {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${c.latitude},${c.longitude}&language=id&key=${API_KEY}`
        );
        const data = await res.json();
        const addr: string | undefined = data.results?.[0]?.formatted_address;
        if (addr) return { name: shortName(addr), address: addr };
        console.warn('[geocode]', data.status, data.error_message ?? '');
    } catch { }
    try {
        const [r] = await Location.reverseGeocodeAsync(c);
        if (r) {
            const address = [r.street, r.district, r.city, r.region].filter(Boolean).join(', ');
            return { name: r.district ?? r.street ?? r.name ?? 'Lokasi dipilih', address };
        }
    } catch { }
    return { name: 'Lokasi dipilih', address: `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}` };
}

const toRad = (d: number) => (d * Math.PI) / 180;
export const haversine = (a: Coords, b: Coords) => {
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
};

function decodePolyline(str: string): Coords[] {
    let i = 0, lat = 0, lng = 0;
    const out: Coords[] = [];
    while (i < str.length) {
        for (const axis of ['lat', 'lng'] as const) {
            let shift = 0, result = 0, b: number;
            do {
                b = str.charCodeAt(i++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const delta = result & 1 ? ~(result >> 1) : result >> 1;
            if (axis === 'lat') lat += delta; else lng += delta;
        }
        out.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return out;
}

async function routesApi(origin: Coords, destination: Coords): Promise<RouteInfo | null> {
    try {
        const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
            },
            body: JSON.stringify({
                origin: { location: { latLng: origin } },
                destination: { location: { latLng: destination } },
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_AWARE',
                languageCode: 'id-ID',
                units: 'METRIC',
            }),
        });
        if (!res.ok) {
            await warnResponse('routes', res);
            return null;
        }
        const data = await res.json();
        const r = data.routes?.[0];
        if (!r?.polyline?.encodedPolyline) return null;
        return {
            distanceMeters: r.distanceMeters ?? 0,
            durationSec: parseInt(String(r.duration ?? '0').replace('s', ''), 10) || 0,
            polyline: decodePolyline(r.polyline.encodedPolyline),
        };
    } catch {
        return null;
    }
}

/** Directions API biasa (legacy) - dipakai kalau Routes API belum aktif */
async function directionsLegacy(origin: Coords, destination: Coords): Promise<RouteInfo | null> {
    try {
        const url =
            'https://maps.googleapis.com/maps/api/directions/json?' +
            qs({
                origin: `${origin.latitude},${origin.longitude}`,
                destination: `${destination.latitude},${destination.longitude}`,
                mode: 'driving',
                language: 'id',
                key: API_KEY,
            });
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== 'OK') {
            console.warn('[directions]', data.status, data.error_message ?? '');
            return null;
        }
        const route = data.routes?.[0];
        const leg = route?.legs?.[0];
        if (!route?.overview_polyline?.points || !leg) return null;
        return {
            distanceMeters: leg.distance?.value ?? 0,
            durationSec: leg.duration?.value ?? 0,
            polyline: decodePolyline(route.overview_polyline.points),
        };
    } catch {
        return null;
    }
}

export async function getRoute(origin: Coords, destination: Coords): Promise<RouteInfo> {
    // 1) Routes API  2) Directions API biasa  3) garis lurus (perkiraan)
    const viaRoutes = await routesApi(origin, destination);
    if (viaRoutes) return viaRoutes;
    const viaDirections = await directionsLegacy(origin, destination);
    if (viaDirections) return viaDirections;
    const dist = haversine(origin, destination) * 1.3;
    return { distanceMeters: dist, durationSec: dist / 8.3, polyline: [origin, destination], isEstimate: true };
}

/* ------------------------------ dipakai flow GoSend ------------------------------ */

/**
 * Wrapper sederhana untuk flow yang tidak butuh session token manual (mis. GoSend).
 * Menjalankan autocomplete lalu fetch detail (koordinat) untuk tiap hasil sekaligus.
 * Membatasi 6 hasil teratas supaya tidak memicu terlalu banyak request "details".
 */
export async function searchPlaces(
    input: string,
    opts?: { origin?: Coords; signal?: AbortSignal }
): Promise<PlaceLoc[]> {
    if (!input.trim()) return [];

    const sessionToken = newSessionToken();

    try {
        const suggestions = await autocompletePlaces(input, {
            origin: opts?.origin,
            sessionToken,
            signal: opts?.signal,
        });

        const top = suggestions.slice(0, 6);

        const results = await Promise.all(
            top.map(async (s) => {
                try {
                    return await getPlaceDetails(s.placeId, sessionToken);
                } catch (error) {
                    console.warn('[searchPlaces] gagal ambil detail untuk', s.placeId, error);
                    return null;
                }
            })
        );

        return results.filter((r): r is PlaceLoc => r !== null);
    } catch (error) {
        console.warn('[searchPlaces] gagal:', error);
        return [];
    }
}