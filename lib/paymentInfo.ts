// lib/paymentInfo.ts
// Helper bersama untuk alur pembayaran QRIS / Virtual Account:
// daftar bank, pembacaan info pembayaran dari respons order, dan pengecekan status lunas.

export const BANKS = [
    { code: 'BRI', label: 'BRI', short: 'BRI', color: '#00529C' },
    { code: 'BNI', label: 'BNI', short: 'BNI', color: '#F15A23' },
    { code: 'MANDIRI', label: 'Mandiri', short: 'MDR', color: '#003D79' },
    { code: 'BCA', label: 'BCA', short: 'BCA', color: '#0060AF' },
    { code: 'PERMATA', label: 'Permata', short: 'PMT', color: '#6CB33F' },
    { code: 'CIMB', label: 'CIMB Niaga', short: 'CIMB', color: '#EC1C24' },
];

export const bankMeta = (code?: string | null) =>
    BANKS.find((b) => b.code === String(code ?? '').toUpperCase()) ?? null;

export type PaymentInfo = {
    va: string | null;
    qris: string | null;
    expired: string | null;
    bank: string | null;
    reff: string | null;
};

// ---------- Seed: info pembayaran dari respons "buat pesanan" ----------
// Disimpan di memori supaya halaman pembayaran bisa langsung menampilkan QR/VA
// walau endpoint "ambil order" tidak mengembalikannya lagi.
const seeds = new Map<number, PaymentInfo>();
export const setPaymentSeed = (orderId: number | string, info: PaymentInfo) => {
    seeds.set(Number(orderId), info);
};
export const getPaymentSeed = (orderId: number | string) => seeds.get(Number(orderId)) ?? null;

// ---------- Baca info pembayaran dari objek order (nama field dibuat toleran) ----------
function pick(sources: any[], keys: string[]): string | null {
    for (const src of sources) {
        for (const k of keys) {
            const v = src?.[k];
            if (v != null && String(v).trim() !== '') return String(v);
        }
    }
    return null;
}

export function extractPayment(o: any): PaymentInfo {
    const sources = [
        o?.payment,
        o?.payment_info,
        o?.payment_detail,
        o?.payment_data,
        o?.linkqu,
        o,
    ].filter((x) => x && typeof x === 'object');

    return {
        va: pick(sources, ['va_number', 'virtual_account', 'virtualAccount', 'va']),
        qris: pick(sources, ['qris_url', 'imageqris', 'qris_image', 'qr_url', 'qris']),
        expired: pick(sources, ['expired_at', 'expired', 'expires_at', 'expiry']),
        bank: pick(sources, ['bank_code', 'bank']),
        reff: pick(sources, ['partner_reff', 'reff']),
    };
}

export const mergePayment = (a: PaymentInfo | null, b: PaymentInfo | null): PaymentInfo => ({
    va: a?.va ?? b?.va ?? null,
    qris: a?.qris ?? b?.qris ?? null,
    expired: a?.expired ?? b?.expired ?? null,
    bank: a?.bank ?? b?.bank ?? null,
    reff: a?.reff ?? b?.reff ?? null,
});

export const hasPaymentInfo = (p: PaymentInfo) => !!(p.va || p.qris);

const PAID = ['paid', 'success', 'settled', 'lunas', 'completed', 'berhasil'];
export const isPaid = (o: any) => PAID.includes(String(o?.payment_status ?? '').toLowerCase());

// ---------- Tanggal ----------
export function parseDate(v?: string | null): number | null {
    if (!v) return null;
    const s = String(v).trim();
    let t = Date.parse(s);
    if (Number.isNaN(t)) t = Date.parse(s.replace(' ', 'T'));
    return Number.isNaN(t) ? null : t;
}