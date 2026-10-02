import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ?? `http://${DEV_HOST}:3000`;

console.log('[api] ========== ENV CHECK ==========');
console.log('[api] EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
console.log('[api] BASE_URL:', BASE_URL);
console.log('[api] Platform.OS:', Platform.OS);
console.log('[api] ================================');

const TOKEN_KEY = 'auth_token';

// ---------- Token helpers ----------
export async function saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ---------- Helpers ----------
function guessMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'jpg':
        case 'jpeg':
        default:
            return 'image/jpeg';
    }
}

// ---------- Response types ----------
export interface AuthResponse {
    token: string;
    userId: string;
    role: 'customer' | 'driver' | 'merchant';
}

export interface ProfileResponse {
    id: string;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    role: 'customer' | 'driver' | 'merchant' | 'admin';
    avatar_url: string | null;
    fcm_token: string | null;
    created_at?: string;
}

// ---- Info customer (di dalam order) ----
export interface CustomerInfo {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
    stats?: {
        total_orders: number;
        rating_avg: number | null;
    } | null;
}

// ---- Info driver (di dalam order) ----
export interface DriverInfo {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
    vehicle_type?: 'motor' | 'mobil' | 'motor_food' | null;
    plate_number?: string | null;
    vehicle_brand?: string | null;
    rating_avg?: number | null;
    total_trips?: number | null;
    coords?: { latitude: number; longitude: number } | null;
}

// ============================================================
// Create Order Payload
// ============================================================
export interface CreateOrderPayload {
    type: 'ride' | 'food' | 'send';
    pickup_name: string;
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_name: string;
    dropoff_address: string;
    dropoff_lat: number;
    dropoff_lng: number;
    distance_km: number;
    duration_min?: number;
    payment_method?: 'cash' | 'wallet' | 'qris' | 'bank_transfer';
    notes?: string;
    merchant_id?: string;
    tariff_code?: string;
    option_name?: string;
    items?: Array<{
        menu_item_id: number;
        name: string;
        variant?: string;
        qty: number;
        price: number;
    }>;
    receiver_name?: string;
    receiver_phone?: string;
    sender_name?: string;
    sender_phone?: string;
    sender_landmark?: string;
    receiver_landmark?: string;
    package_type?: string;
    package_size?: 'kecil' | 'sedang' | 'besar';
    package_weight?: string;
    package_protection?: 'silver' | 'gold';
}

// ============================================================
// Order Response
// ============================================================
export interface OrderResponse {
    id: number;
    order_code: string;
    type: 'ride' | 'food' | 'send';
    status:
    | 'pending'
    | 'accepted'
    | 'arrived'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
    customer_id: string;
    driver_id: string | null;
    merchant_id: string | null;
    pickup_name: string | null;
    pickup_address: string | null;
    dropoff_name: string | null;
    dropoff_address: string | null;
    distance_km: number | null;
    duration_min: number | null;
    subtotal: number;
    delivery_fee: number;
    packaging_fee: number;
    admin_fee: number;
    total_fare: number;
    driver_earning: number;
    merchant_earning: number;
    platform_earning: number;
    payment_method: string;
    payment_status: string;
    notes: string | null;
    tariff_code?: string | null;
    option_name?: string | null;
    send_code?: string | null;

    accepted_at?: string | null;
    arrived_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    cancelled_at?: string | null;
    cancellation_reason?: string | null;

    created_at: string;
    updated_at: string;

    pickup_coords?: { latitude: number; longitude: number } | null;
    dropoff_coords?: { latitude: number; longitude: number } | null;

    customer?: CustomerInfo | null;
    driver?: DriverInfo | null;
    merchant?: {
        user_id: string;
        store_name: string;
        address: string | null;
        logo_url: string | null;
    } | null;

    sender_landmark?: string;
    receiver_landmark?: string;

    package_type?: string | null;
    package_size?: string | null;
    package_weight?: string | null;
    package_protection?: string | null;

    sender_name?: string | null;
    receiver_name?: string | null;
    receiver_phone?: string | null;
    sender_phone?: string | null;
}

export interface SavedAddress {
    id: number;
    user_id: string;
    kind: 'home' | 'office' | 'other';
    label: string | null;
    name: string;
    address: string;
    place_id: string | null;
    location: any;
    created_at: string;
    updated_at: string;
}

export interface Tariff {
    id: number;
    code: string;
    label: string;
    service_type: 'motor' | 'mobil' | 'food' | 'send';
    min_fare: number;
    per_km: number;
    base_km: number;
    capacity: number;
    eta_min: number;
    desc_text: string | null;
    is_active: boolean;
    sort_order: number;
}

// ---- Chat types ----
export interface ChatRoom {
    id: number;
    order_id: number;
    customer_id: string;
    driver_id: string | null;
    merchant_id: string | null;
    last_message_at: string | null;
    created_at: string;
}

export interface ChatMessage {
    id: number;
    room_id: number;
    sender_id: string;
    message: string | null;
    attachment_url: string | null;
    message_type: 'text' | 'image' | 'location';
    is_read: boolean;
    created_at: string;
}

export interface NearbyDriver {
    id: string;
    name: string;
    avatar_url: string | null;
    vehicle_type: 'motor' | 'mobil' | 'motor_food';
    plate_number: string | null;
    vehicle_brand: string | null;
    rating_avg: number;
    total_trips: number;
    distance_m: number;
    coords: { latitude: number; longitude: number } | null;
}

// ============================================================
// Core request (JSON)
// ============================================================
async function request<T>(
    path: string,
    options: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
    const { method = 'GET', body, auth = false } = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (auth) {
        const token = await getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    let json: any = null;
    try {
        json = await res.json();
    } catch {
        throw new Error(`Server error (${res.status})`);
    }

    if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Request failed (${res.status})`);
    }
    return json.data as T;
}

// ============================================================
// Upload file (multipart/form-data) — dipakai avatar & chat image
// ============================================================
async function uploadFile<T>(
    path: string,
    fieldName: string,
    file: { uri: string; name: string; type: string }
): Promise<T> {
    const token = await getToken();
    const formData = new FormData();

    // React Native: formData.append dengan object {uri, name, type}
    formData.append(fieldName, file as any);

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    // ⚠️ JANGAN set Content-Type manual — fetch auto-set multipart boundary

    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: formData,
    });

    let json: any = null;
    try {
        json = await res.json();
    } catch {
        throw new Error(`Server error (${res.status})`);
    }

    if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Upload gagal (${res.status})`);
    }
    return json.data as T;
}

// ============================================================
// API
// ============================================================
export const api = {
    // ===== Auth =====
    register: (input: {
        email: string;
        password: string;
        full_name: string;
        role?: 'customer' | 'driver' | 'merchant';
    }) =>
        request<AuthResponse>('/api/auth/register', {
            method: 'POST',
            body: input,
        }),

    login: (input: { email: string; password: string }) =>
        request<AuthResponse>('/api/auth/login', {
            method: 'POST',
            body: input,
        }),

    me: () => request<ProfileResponse>('/api/auth/me', { auth: true }),

    // ===== Profile =====
    updateProfile: (input: {
        full_name?: string;
        phone?: string;
        email?: string;
        avatar_url?: string;
        fcm_token?: string;
    }) =>
        request<ProfileResponse>('/api/profiles/me', {
            method: 'PUT',
            body: input,
            auth: true,
        }),

    /**
     * Upload foto profil ke backend.
     * Backend akan upload ke Supabase Storage + update profiles.avatar_url.
     *
     * @param uri - local URI dari ImagePicker
     * @param mimeType - 'image/jpeg' | 'image/png' | 'image/webp'
     * @returns { avatar_url: string }
     */
    uploadAvatar: (uri: string, mimeType = 'image/jpeg') => {
        const fileName = uri.split('/').pop() ?? 'avatar.jpg';
        return uploadFile<{ avatar_url: string }>(
            '/api/profiles/avatar',
            'image',
            {
                uri,
                name: fileName,
                type: mimeType,
            }
        );
    },

    getProfileById: (userId: string) =>
        request<ProfileResponse>(`/api/profiles/${userId}`, { auth: true }),

    // ===== Orders =====
    createOrder: (payload: CreateOrderPayload) =>
        request<OrderResponse>('/api/orders', {
            method: 'POST',
            body: payload,
            auth: true,
        }),

    getOrder: (orderId: number) =>
        request<OrderResponse>(`/api/orders/${orderId}`, { auth: true }),

    listOrders: (status?: string) =>
        request<OrderResponse[]>(
            `/api/orders${status ? `?status=${status}` : ''}`,
            { auth: true }
        ),

    acceptOrder: (orderId: number) =>
        request<OrderResponse>(`/api/orders/${orderId}/accept`, {
            method: 'POST',
            auth: true,
        }),

    updateOrderStatus: (
        orderId: number,
        status:
            | 'accepted'
            | 'arrived'
            | 'in_progress'
            | 'completed'
            | 'cancelled',
        reason?: string,
        sendCode?: string
    ) =>
        request<OrderResponse>(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            body: { status, reason, send_code: sendCode },
            auth: true,
        }),

    // ===== Notifications =====
    listNotifications: () =>
        request<any[]>('/api/notifications', { auth: true }),

    markNotificationRead: (id: number) =>
        request<null>(`/api/notifications/${id}/read`, {
            method: 'PUT',
            auth: true,
        }),

    // ===== Chat =====
    chat: {
        openRoom: (orderId: number) =>
            request<ChatRoom>(`/api/chats/rooms/order/${orderId}`, {
                method: 'POST',
                auth: true,
            }),

        listMessages: (roomId: number, limit = 100) =>
            request<ChatMessage[]>(
                `/api/chats/rooms/${roomId}/messages?limit=${limit}`,
                { auth: true }
            ),

        send: (
            roomId: number,
            message: string,
            type: 'text' | 'image' | 'location' = 'text'
        ) =>
            request<ChatMessage>(`/api/chats/rooms/${roomId}/messages`, {
                method: 'POST',
                body: { message, type },
                auth: true,
            }),

        sendImage: (
            roomId: number,
            uri: string,
            fileName?: string,
            mimeType?: string
        ) => {
            const name = fileName ?? uri.split('/').pop() ?? 'photo.jpg';
            const type = mimeType ?? guessMimeType(name);
            return uploadFile<ChatMessage>(
                `/api/chats/rooms/${roomId}/images`,
                'image',
                { uri, name, type }
            );
        },

        markRead: (roomId: number) =>
            request<null>(`/api/chats/rooms/${roomId}/read`, {
                method: 'PUT',
                auth: true,
            }),

        listRooms: () =>
            request<ChatRoom[]>('/api/chats/rooms', { auth: true }),
    },

    // ===== Saved Addresses =====
    savedAddresses: {
        list: () =>
            request<SavedAddress[]>('/api/saved-addresses', { auth: true }),

        get: (kind: 'home' | 'office' | 'other') =>
            request<SavedAddress | null>(`/api/saved-addresses/${kind}`, {
                auth: true,
            }),

        upsert: (input: {
            kind: 'home' | 'office' | 'other';
            label?: string;
            name: string;
            address: string;
            place_id?: string;
            latitude: number;
            longitude: number;
        }) =>
            request<SavedAddress>('/api/saved-addresses', {
                method: 'POST',
                body: input,
                auth: true,
            }),

        remove: (kind: 'home' | 'office' | 'other') =>
            request<null>(`/api/saved-addresses/${kind}`, {
                method: 'DELETE',
                auth: true,
            }),
    },

    // ===== Tariffs =====
    tariffs: {
        list: () => request<Tariff[]>('/api/tariffs'),
        calculate: (code: string, distanceKm: number) =>
            request<{
                code: string;
                label: string;
                price: number;
                distance_km: number;
                min_fare: number;
                per_km: number;
                base_km: number;
                eta_min: number;
                capacity: number;
            }>(
                `/api/tariffs/calculate?code=${code}&distance_km=${distanceKm}`
            ),
    },

    // ===== Ratings =====
    submitRating: (input: {
        orderId: number;
        rating: number;
        comment?: string;
        tags?: string[];
    }) =>
        request<{
            id: number;
            order_id: number;
            rating: number;
            comment: string | null;
            tags: string[];
        }>('/api/ratings', {
            method: 'POST',
            body: input,
            auth: true,
        }),

    // ===== Drivers =====
    drivers: {
        nearby: (lat: number, lng: number, radius = 5000, limit = 50) =>
            request<NearbyDriver[]>(
                `/api/drivers/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`,
                { auth: true }
            ),

        updateServices: (services: string[]) =>
            request<any>('/api/drivers/services', {
                method: 'PUT',
                body: { services },
                auth: true,
            }),

        getMyProfile: () =>
            request<any>('/api/drivers/profile', { auth: true }),
    },

    // ===== Activity (notifikasi pintar) =====
    // ⬅️ Komentar nyasar dihapus
    activity: {
        ping: () =>
            request<null>('/api/activity/ping', { method: 'POST', auth: true }),

        quote: (body: {
            service: 'ride' | 'send' | 'food';
            origin_name: string;
            origin_lat: number;
            origin_lng: number;
            dest_name: string;
            dest_lat: number;
            dest_lng: number;
            option_name: string | null;
            price: number | null;
            eta_min: number | null;
            distance_km: number | null;
        }) =>
            request<null>('/api/activity/quote', {
                method: 'POST',
                body,
                auth: true,
            }),
    },
};