/** Ambil digit lokal tanpa awalan 0 / 62 / +62 (untuk ditampilkan di input +62) */
export function normalizePhoneLocal(p?: string | null): string {
    const digits = (p ?? '').replace(/\D/g, '');
    if (digits.startsWith('62')) return digits.slice(2);
    if (digits.startsWith('0')) return digits.slice(1);
    return digits;
}

/** Format untuk payload & database: "+62812xxxx", atau '' bila kosong */
export function toE164(p?: string | null): string {
    const local = normalizePhoneLocal(p);
    return local ? `+62${local}` : '';
}

/** Format untuk ditampilkan: "+62 812xxxx" (aman untuk data lama tanpa +62) */
export function displayPhone(p?: string | null): string {
    const local = normalizePhoneLocal(p);
    return local ? `+62 ${local}` : '';
}