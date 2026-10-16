// lib/api.ts
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

// ============================================================
// TOKEN HELPERS
// ============================================================
export async function saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ============================================================
// HELPERS
// ============================================================
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

async function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    ms = 30000
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error(
                'Server terlalu lama merespons. Coba lagi sebentar.'
            );
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

// ✅ Helper query string
function qs(
    params?: Record<
        string,
        string | number | boolean | undefined | null
    >
): string {
    if (!params) return '';
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
            search.append(k, String(v));
        }
    });
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ============================================================
// TYPES
// ============================================================
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
    bank_code?: string;

    notes?: string;

    // FOOD
    merchant_id?: string;
    items?: Array<{
        menu_item_id: number;
        name: string;
        variant?: string;
        qty: number;
        price: number;
        note?: string;
    }>;
    subtotal?: number;
    delivery_fee?: number;
    service_fee?: number;
    total?: number;

    // RIDE
    tariff_code?: string;
    option_name?: string;

    // SEND
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

    items?: Array<{
        id: number;
        menu_item_id: number;
        name: string;
        variant?: string | null;
        qty: number;
        price: number;
        note?: string | null;
        image_url?: string | null;
    }> | null;

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

export interface ChatRoom {
    id: number;
    order_id: number;
    customer_id: string;
    driver_id: string | null;
    merchant_id: string | null;
    last_message_at: string | null;
    created_at: string;
    chat_open?: boolean;
    chat_closes_at?: string | null;
}

export interface ChatRoomListItem {
    id: number;
    order_id: number;
    peer_id: string;
    peer_name: string;
    peer_avatar: string | null;
    peer_role: 'customer' | 'driver' | 'merchant' | 'user';
    last_message: string;
    last_message_type: 'text' | 'image' | 'location';
    last_message_at: string | null;
    created_at: string;
    unread_count?: number;
    chat_open?: boolean;
    chat_closes_at?: string | null;

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

export interface NearbyMerchant {
    user_id: string;
    store_name: string;
    description?: string | null;
    address?: string | null;
    latitude: number | null;
    longitude: number | null;
    logo_url?: string | null;
    cover_url?: string | null;
    open_hours?: string | Record<string, string> | null;
    phone?: string | null;
    is_open: boolean;
    rating_avg?: number | null;
    rating_count?: number | null;
    total_orders?: number | null;
    latest_review?: string | null;
    category_label?: string | null;

    distance_m?: number | null;
    route_distance_m?: number | null;
    delivery_fee?: number | null;
    eta_min?: number | null;
    eta_source?: 'google' | 'estimate' | null;
}

export interface MerchantMenuResponse {
    merchant_id: string;
    categories: Array<{ id: number; name: string; sort_order: number }>;
    items: Array<{
        id: number;
        merchant_id: string;
        category_id: number | null;
        category_name?: string | null;
        name: string;
        description: string | null;
        price: number;
        image_url: string | null;
        is_available: boolean;
        stock: number | null;
    }>;
}

export interface DeliveryEstimate {
    distance_km: number;
    delivery_fee: number;
    service_fee: number;
    eta_min: number;
    eta_source: 'google' | 'estimate';
}

export interface PublicAsset {
    id: number;
    key: string;
    category:
    | 'banner'
    | 'icon'
    | 'marker'
    | 'splash'
    | 'other'
    | string;
    url: string;
    width: number | null;
    height: number | null;
    label: string | null;
}

export interface TopupItem {
    id: number;
    partner_reff: string;
    method: 'va' | 'qris';
    amount: number;         // total bayar (nominal + fee)
    nominal: number;        // nominal topup
    admin_fee: number;      // fee
    bank_code: string | null;
    va_number: string | null;
    qris_url: string | null;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
    created_at: string;
    expired_at: string | null;
}

export interface WithdrawalItem {
    id: number;
    inquiry_reff: string;
    partner_reff: string;
    partner_reff_pay: string | null;
    bank_code: string;
    account_number: string;
    amount: number;         // nominal
    fee_admin: number;      // fee
    status: 'INQUIRY' | 'PENDING' | 'SUCCESS' | 'FAILED';
    created_at: string;
    updated_at: string;
}

export interface TransactionItem {
    id: string;             // "topup-1", "withdraw-2", "tx-3"
    type:
    | 'topup'
    | 'withdraw'
    | 'payout'
    | 'order_payment'
    | 'refund'
    | 'adjustment'
    | 'debt_payment'
    | 'earning_cash'
    | 'earning_gateway'
    | 'commission_cash'
    | 'commission_gateway';
    amount: number;
    total_amount: number;
    admin_fee: number;
    method: string;
    status: string;
    reference: string | null;
    va_number?: string | null;
    qris_url?: string | null;
    bank_code?: string | null;
    account_number?: string | null;
    description: string;
    created_at: string;
}

// ============================================================
// CORE REQUEST — JSON
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

    const url = `${BASE_URL}${path}`;

    console.log('\n========== [api] REQUEST ==========');
    console.log('[api] METHOD:', method);
    console.log('[api] URL:', url);
    console.log('[api] AUTH:', auth);
    if (body) {
        console.log('[api] BODY:', JSON.stringify(body, null, 2));
    }
    console.log('====================================\n');

    const res = await fetchWithTimeout(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    let json: any = null;
    let text = '';
    try {
        text = await res.text();
        json = text ? JSON.parse(text) : null;
    } catch {
        console.log('[api] NON-JSON RESPONSE:', text);
    }

    console.log('\n========== [api] RESPONSE ==========');
    console.log('[api] STATUS:', res.status);
    console.log('[api] OK:', res.ok);
    console.log('[api] BODY:', JSON.stringify(json, null, 2));
    console.log('=====================================\n');

    if (!res.ok || !json?.success) {
        console.log('\n========== [api] ERROR DETAIL ==========');
        console.log('[api] MESSAGE:', json?.message);
        console.log('[api] ERRORS:', json?.errors);
        console.log('[api] DATA:', json?.data);
        console.log('[api] FULL:', json);
        console.log('=========================================\n');

        let errMsg = json?.message || `Request failed (${res.status})`;
        if (json?.errors && typeof json.errors === 'object') {
            const fields = Object.entries(json.errors)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n');
            errMsg = `${errMsg}\n\n${fields}`;
        }
        throw new Error(errMsg);
    }
    return json.data as T;
}

// ============================================================
// UPLOAD FILE (multipart)
// ============================================================
async function uploadFile<T>(
    path: string,
    fieldName: string,
    file: { uri: string; name: string; type: string }
): Promise<T> {
    const token = await getToken();
    const formData = new FormData();

    formData.append(fieldName, file as any);

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
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
// API OBJECT
// ============================================================
export const api = {
    // ────────────────────────────────────────────────────────
    // PUBLIC (tanpa auth — untuk aplikasi customer)
    // ────────────────────────────────────────────────────────
    public: {
        /**
         * List asset publik per kategori.
         * Endpoint: GET /api/public/assets?category=banner&limit=10
         */
        assets: (opts?: {
            category?:
            | 'banner'
            | 'icon'
            | 'marker'
            | 'splash'
            | 'other'
            | string;
            limit?: number;
        }) =>
            request<{ items: PublicAsset[] }>(
                `/api/public/assets${qs({
                    category: opts?.category,
                    limit: opts?.limit,
                })}`
                // auth default = false → tanpa Authorization
            ),
    },

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

    uploadAvatar: (uri: string, mimeType = 'image/jpeg') => {
        const fileName = uri.split('/').pop() ?? 'avatar.jpg';
        return uploadFile<{ avatar_url: string }>(
            '/api/profiles/avatar',
            'image',
            { uri, name: fileName, type: mimeType }
        );
    },

    getProfileById: (userId: string) =>
        request<ProfileResponse>(`/api/profiles/${userId}`, { auth: true }),

    // ===== Orders =====
    orders: {
        create: (payload: CreateOrderPayload) =>
            request<OrderResponse>('/api/orders', {
                method: 'POST',
                body: payload,
                auth: true,
            }),

        get: (orderId: number) =>
            request<OrderResponse>(`/api/orders/${orderId}`, { auth: true }),

        list: (status?: string) =>
            request<OrderResponse[]>(
                `/api/orders${status ? `?status=${status}` : ''}`,
                { auth: true }
            ),

        accept: (orderId: number) =>
            request<OrderResponse>(`/api/orders/${orderId}/accept`, {
                method: 'POST',
                auth: true,
            }),

        updateStatus: (
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

        cancel: (orderId: number, reason?: string) =>
            request<OrderResponse>(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                body: { status: 'cancelled', reason },
                auth: true,
            }),

        estimateDelivery: (input: {
            merchant_id: string;
            dropoff_lat: number;
            dropoff_lng: number;
            subtotal: number;
        }) =>
            request<DeliveryEstimate>('/api/orders/estimate-delivery', {
                method: 'POST',
                body: input,
                auth: true,
            }),
    },

    // Backward-compat (tetap didukung)
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
            const name =
                fileName ?? uri.split('/').pop() ?? 'photo.jpg';
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
            request<ChatRoomListItem[]>('/api/chats/rooms', { auth: true }),

        /** Status jendela chat (ditutup 30 menit setelah pesanan selesai). */
        roomStatus: (roomId: number) =>
            request<{
                room_id: number;
                order_id: number;
                chat_open: boolean;
                chat_closes_at: string | null;
            }>(`/api/chats/rooms/${roomId}/status`, { auth: true }),

    },

    // ===== Saved Addresses =====
    savedAddresses: {
        list: () =>
            request<SavedAddress[]>('/api/saved-addresses', {
                auth: true,
            }),

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
        nearby: (
            lat: number,
            lng: number,
            radius = 5000,
            limit = 50
        ) =>
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

    // ===== Merchants =====
    merchants: {
        nearby: (lat: number, lng: number, radius = 5000) =>
            request<NearbyMerchant[]>(
                `/api/merchant/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
                { auth: true }
            ),

        detail: (merchantId: string) =>
            request<NearbyMerchant>(`/api/merchant/${merchantId}`, {
                auth: true,
            }),

        profile: (merchantId: string) =>
            request<any>(`/api/merchant/${merchantId}`, { auth: true }),

        menu: (merchantId: string) =>
            request<MerchantMenuResponse>(
                `/api/merchant/${merchantId}/menu`,
                { auth: true }
            ),

        foodMenu: (merchantId: string) =>
            request<MerchantMenuResponse>(
                `/api/merchant/${merchantId}/menu`,
                { auth: true }
            ),
    },

    // ===== Wallet =====
    wallet: {
        get: () =>
            request<{
                balance: number;
                pending_balance: number;
                net_balance: number;
                updated_at: string;
            }>('/api/wallet', { auth: true }),

        ledger: (limit = 50, offset = 0) =>
            request<
                Array<{
                    id: number;
                    user_id: string;
                    type: string;
                    amount: number;
                    balance_after: number;
                    reference_id: string | null;
                    description: string | null;
                    created_at: string;
                }>
            >(
                `/api/wallet/ledger?limit=${limit}&offset=${offset}`,
                { auth: true }
            ),

        topupInquiry: (input: {
            amount: number;
            method: 'va' | 'qris';
            bank_code?: string;
        }) =>
            request<{
                partner_reff: string;
                virtual_account?: string;
                imageqris?: string;
                expired?: string;
                [key: string]: any;
            }>('/api/wallet/topup/inquiry', {
                method: 'POST',
                body: input,
                auth: true,
            }),

        topupExecute: (partnerReff: string) =>
            request<any>('/api/wallet/topup/execute', {
                method: 'POST',
                body: { partner_reff: partnerReff },
                auth: true,
            }),

        topupStatus: (partnerReff: string) =>
            request<{
                id: number;
                user_id: string;
                partner_reff: string;
                method: 'va' | 'qris';
                amount: number;
                nominal: number;
                admin_fee: number;
                bank_code: string | null;
                va_number: string | null;
                qris_url: string | null;
                status: 'PENDING' | 'SUCCESS' | 'FAILED';
                expired_at: string | null;
                created_at: string;
            }>(`/api/wallet/topup/status/${partnerReff}`, {
                auth: true,
            }),

        withdrawInquiry: (input: {
            amount: number;
            bank_code: string;
            account_number: string;
        }) =>
            request<any>('/api/wallet/withdraw/inquiry', {
                method: 'POST',
                body: input,
                auth: true,
            }),

        withdrawExecute: (inquiryReff: string) =>
            request<any>('/api/wallet/withdraw/execute', {
                method: 'POST',
                body: { inquiry_reff: inquiryReff },
                auth: true,
            }),

        savedAccounts: () =>
            request<
                Array<{
                    id: number;
                    user_id: string;
                    bank_code: string;
                    account_number: string;
                    account_name: string;
                    created_at: string;
                }>
            >('/api/wallet/saved-accounts', { auth: true }),

        saveAccount: (input: {
            bank_code: string;
            account_number: string;
            account_name: string;
        }) =>
            request<any>('/api/wallet/saved-accounts', {
                method: 'POST',
                body: input,
                auth: true,
            }),

        deleteAccount: (id: number) =>
            request<null>(`/api/wallet/saved-accounts/${id}`, {
                method: 'DELETE',
                auth: true,
            }),

        topups: (limit = 20, offset = 0, status?: string) => {
            const qs = new URLSearchParams({
                limit: String(limit),
                offset: String(offset),
            });
            if (status) qs.set('status', status);

            return request<{
                items: TopupItem[];
                total: number;
                limit: number;
                offset: number;
            }>(`/api/wallet/topups?${qs}`, { auth: true });
        },

        /** 🆕 History withdraw */
        withdrawals: (limit = 20, offset = 0, status?: string) => {
            const qs = new URLSearchParams({
                limit: String(limit),
                offset: String(offset),
            });
            if (status) qs.set('status', status);

            return request<{
                items: WithdrawalItem[];
                total: number;
                limit: number;
                offset: number;
            }>(`/api/wallet/withdrawals?${qs}`, { auth: true });
        },

        /** 🆕 History gabungan (topup + withdraw + order payment + refund) */
        transactions: (limit = 20, offset = 0) =>
            request<{
                items: TransactionItem[];
                limit: number;
                offset: number;
            }>(`/api/wallet/transactions?limit=${limit}&offset=${offset}`, {
                auth: true,
            }),
    },

    // ===== Activity =====
    activity: {
        ping: () =>
            request<null>('/api/activity/ping', {
                method: 'POST',
                auth: true,
            }),

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

// ============================================================
// EXPORT TAMBAHAN
// ============================================================
export type { Tariff as TariffType };
