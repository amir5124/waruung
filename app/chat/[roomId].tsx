import { colors } from '@/constants/ojek-theme';
import { api, ChatMessage, getToken } from '@/lib/api';
import { supabase } from '@/lib/supabase-client';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
    primary: colors.primary,
    textDark: colors.text,
    textMuted: colors.textMuted,
    border: colors.border,
};

export default function ChatScreen() {
    const insets = useSafeAreaInsets();
    const { roomId, peerName } = useLocalSearchParams<{
        roomId: string;
        peerName?: string;
    }>();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [myId, setMyId] = useState<string | null>(null);
    const listRef = useRef<FlatList<ChatMessage>>(null);
    const channelRef = useRef<any>(null);
    const myIdRef = useRef<string | null>(null);
    const roomIdNum = Number(roomId);

    // ========== Alert bottom sheet ==========
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [alertAction, setAlertAction] = useState<(() => void) | null>(null);
    const [alertActionLabel, setAlertActionLabel] = useState('Mengerti');

    const showAlert = (
        title: string,
        message: string,
        actionLabel?: string,
        onAction?: () => void
    ) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertActionLabel(actionLabel ?? 'Mengerti');
        setAlertAction(() => onAction ?? null);
        setTimeout(() => setAlertVisible(true), Platform.OS === 'ios' ? 300 : 0);
    };

    const closeAlert = () => {
        setAlertVisible(false);
        setAlertAction(null);
    };

    // Simpan myId ke ref supaya tidak trigger re-subscribe
    useEffect(() => {
        myIdRef.current = myId;
        console.log('[chat] myId updated:', myId);
    }, [myId]);

    // Log setiap kali messages berubah
    useEffect(() => {
        console.log(
            '[chat] messages state updated: count =',
            messages.length,
            'ids =',
            messages.map((m) => m.id)
        );
    }, [messages]);

    // Ambil user id dari token
    useEffect(() => {
        (async () => {
            try {
                const token = await getToken();
                if (!token) {
                    console.warn('[chat] tidak ada token');
                    return;
                }
                const payload = JSON.parse(atob(token.split('.')[1]));
                console.log('[chat] myId dari token:', payload.sub);
                setMyId(payload.sub);
            } catch (err) {
                console.warn('[chat] gagal parse token:', err);
            }
        })();
    }, []);

    // Load pesan awal — dengan timeout
    useEffect(() => {
        let alive = true;
        (async () => {
            console.log('[chat] === LOAD MESSAGES START ===');
            console.log('[chat] roomId:', roomIdNum);

            try {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout 10s')), 10000)
                );

                const data = (await Promise.race([
                    api.chat.listMessages(roomIdNum),
                    timeoutPromise,
                ])) as ChatMessage[];

                if (!alive) return;

                console.log('[chat] LOADED:', data.length, 'pesan');
                setMessages(data);

                api.chat.markRead(roomIdNum).catch((err) => {
                    console.warn('[chat] markRead gagal:', err.message);
                });
            } catch (err: any) {
                console.error('[chat] GAGAL LOAD:', err.message);
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [roomIdNum]);

    // Subscribe Supabase Realtime
    useEffect(() => {
        console.log('[chat] === SUBSCRIBE REALTIME ===');
        const channel = supabase
            .channel(`chat:${roomIdNum}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `room_id=eq.${roomIdNum}`,
                },
                (payload) => {
                    const newMsg = payload.new as ChatMessage;
                    console.log('[chat] 🔔 Realtime pesan baru:', newMsg.id, newMsg.message_type);

                    setMessages((prev) => {
                        if (prev.some((m) => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });

                    if (newMsg.sender_id !== myIdRef.current) {
                        api.chat.markRead(roomIdNum).catch(() => { });
                    }
                }
            )
            .subscribe((status, err) => {
                console.log('[chat] Realtime status:', status);
                if (err) {
                    console.log('[chat] Realtime error:', JSON.stringify(err, null, 2));
                }
            });

        channelRef.current = channel;

        return () => {
            console.log('[chat] === UNSUBSCRIBE REALTIME ===');
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [roomIdNum]);

    // Auto-scroll ke bawah saat pesan baru
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages.length]);

    // ========== Kirim Teks ==========
    const handleSend = async () => {
        const text = input.trim();
        if (!text || sending) return;

        setInput('');
        setSending(true);

        try {
            const sent = await api.chat.send(roomIdNum, text);
            console.log('[chat] Pesan terkirim, id:', sent.id);

            setMessages((prev) => {
                if (prev.some((m) => m.id === sent.id)) return prev;
                return [...prev, sent];
            });
        } catch (err: any) {
            console.error('[chat] Gagal kirim:', err.message);
            setInput(text);
            showAlert('Gagal Kirim', err.message || 'Coba lagi.');
        } finally {
            setSending(false);
        }
    };

    // ========== Pilih dari Galeri ==========
    const handlePickFromLibrary = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                showAlert(
                    'Izin dibutuhkan',
                    'Aktifkan akses galeri untuk kirim foto.',
                    'Buka Pengaturan',
                    () => {
                        // Bisa tambah Linking.openSettings() kalau perlu
                    }
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
                exif: false,
            });

            if (result.canceled || !result.assets?.length) return;

            await uploadImage(result.assets[0]);
        } catch (err: any) {
            console.error('[chat] Gagal buka galeri:', err.message);
            showAlert('Gagal', err.message || 'Tidak bisa buka galeri.');
        }
    };

    // ========== Ambil dari Kamera ==========
    const handlePickFromCamera = async () => {
        try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
                showAlert(
                    'Izin dibutuhkan',
                    'Aktifkan akses kamera untuk ambil foto.',
                    'Mengerti'
                );
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
                exif: false,
            });

            if (result.canceled || !result.assets?.length) return;

            await uploadImage(result.assets[0]);
        } catch (err: any) {
            console.error('[chat] Gagal buka kamera:', err.message);
            showAlert('Gagal', err.message || 'Tidak bisa buka kamera.');
        }
    };

    // ========== Upload Gambar ke Backend ==========
    const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
        console.log('[chat] === UPLOAD IMAGE ===');
        console.log('[chat] uri:', asset.uri);
        console.log('[chat] mimeType:', asset.mimeType);
        console.log('[chat] fileName:', asset.fileName);

        setUploading(true);

        try {
            const msg = await api.chat.sendImage(
                roomIdNum,
                asset.uri,
                asset.fileName ?? undefined,
                asset.mimeType ?? undefined
            );

            console.log('[chat] Image terkirim, id:', msg.id);

            setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
        } catch (err: any) {
            console.error('[chat] Upload gagal:', err.message);
            showAlert('Gagal Kirim Foto', err.message || 'Coba lagi.');
        } finally {
            setUploading(false);
        }
    };

    // ========== Modal Pilih Sumber Foto ==========
    const [sourceModalVisible, setSourceModalVisible] = useState(false);

    const openSourcePicker = () => {
        setSourceModalVisible(true);
    };

    const pickFromGallery = () => {
        setSourceModalVisible(false);
        setTimeout(() => handlePickFromLibrary(), 250);
    };

    const pickFromCamera = () => {
        setSourceModalVisible(false);
        setTimeout(() => handlePickFromCamera(), 250);
    };

    // ========== Render Item ==========
    const renderItem = ({ item }: { item: ChatMessage }) => {
        const mine = item.sender_id === myId;
        const isImage = item.message_type === 'image' && !!item.attachment_url;

        return (
            <View style={[s.msgRow, mine ? s.msgRowMine : s.msgRowTheirs]}>
                <View
                    style={[
                        s.bubble,
                        mine ? s.bubbleMine : s.bubbleTheirs,
                        isImage && s.bubbleImage,
                    ]}
                >
                    {isImage ? (
                        <View>
                            <Image
                                source={{ uri: item.attachment_url! }}
                                style={s.imageMsg}
                                resizeMode="cover"
                            />
                            <View style={s.imageTimeWrap}>
                                <Text style={s.imageTime}>
                                    {new Date(item.created_at).toLocaleTimeString('id-ID', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <>
                            <Text style={[s.msgText, mine && { color: '#fff' }]}>
                                {item.message}
                            </Text>
                            <Text style={[s.msgTime, mine && { color: '#d0e8f8' }]}>
                                {new Date(item.created_at).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Text>
                        </>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={s.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={s.header}>
                <Pressable onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle} numberOfLines={1}>
                        {peerName ?? 'Chat'}
                    </Text>
                    <Text style={s.headerSub}>
                        {loading ? 'Memuat...' : `${messages.length} pesan`}
                    </Text>
                </View>
            </View>

            {/* Messages + Input */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {loading ? (
                    <View style={s.loadingWrap}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={s.loadingText}>Memuat pesan...</Text>
                    </View>
                ) : messages.length === 0 ? (
                    <View style={s.emptyWrap}>
                        <Ionicons
                            name="chatbubble-outline"
                            size={48}
                            color={colors.textMuted}
                        />
                        <Text style={s.emptyText}>
                            Belum ada pesan. Mulai percakapan!
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        ref={listRef}
                        data={messages}
                        keyExtractor={(m) => String(m.id)}
                        renderItem={renderItem}
                        contentContainerStyle={{
                            padding: 16,
                            gap: 8,
                            paddingBottom: 8,
                        }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    />
                )}

                {/* Input bar */}
                <View
                    style={[
                        s.inputBar,
                        { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 },
                    ]}
                >
                    <Pressable
                        onPress={openSourcePicker}
                        disabled={uploading}
                        style={[s.iconBtn, uploading && { opacity: 0.5 }]}
                    >
                        {uploading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Ionicons
                                name="camera-outline"
                                size={22}
                                color={colors.primary}
                            />
                        )}
                    </Pressable>

                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        placeholder="Tulis pesan..."
                        placeholderTextColor={colors.textMuted}
                        style={s.input}
                        multiline
                        maxLength={500}
                    />

                    {input.trim() ? (
                        <Pressable
                            onPress={handleSend}
                            disabled={sending}
                            style={[
                                s.sendBtn,
                                sending && { opacity: 0.5 },
                            ]}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="send" size={20} color="#fff" />
                            )}
                        </Pressable>
                    ) : null}
                </View>
            </KeyboardAvoidingView>

            {/* ========== Modal Loading Upload ========== */}
            <Modal
                animationType="fade"
                transparent
                visible={uploading}
                onRequestClose={() => { }}
            >
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingLabel}>Mengirim foto…</Text>
                    </View>
                </View>
            </Modal>

            {/* ========== Modal Pilih Sumber Foto ========== */}
            <Modal
                visible={sourceModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setSourceModalVisible(false)}
            >
                <Pressable
                    style={styles.sourceOverlay}
                    onPress={() => setSourceModalVisible(false)}
                >
                    <Pressable style={styles.sourceSheet} onPress={() => { }}>
                        <View style={styles.sourceHandle} />
                        <Text style={styles.sourceTitle}>Kirim Foto</Text>

                        <Pressable
                            style={styles.sourceOption}
                            onPress={pickFromCamera}
                        >
                            <View style={styles.sourceIconWrap}>
                                <Ionicons
                                    name="camera"
                                    size={22}
                                    color={colors.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.sourceOptionLabel}>
                                    Ambil Foto
                                </Text>
                                <Text style={styles.sourceOptionSub}>
                                    Buka kamera dan jepret sekarang
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={18}
                                color={colors.textMuted}
                            />
                        </Pressable>

                        <Pressable
                            style={styles.sourceOption}
                            onPress={pickFromGallery}
                        >
                            <View style={styles.sourceIconWrap}>
                                <Ionicons
                                    name="images"
                                    size={22}
                                    color={colors.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.sourceOptionLabel}>
                                    Pilih dari Galeri
                                </Text>
                                <Text style={styles.sourceOptionSub}>
                                    Ambil foto yang sudah ada
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={18}
                                color={colors.textMuted}
                            />
                        </Pressable>

                        <Pressable
                            style={styles.sourceCancel}
                            onPress={() => setSourceModalVisible(false)}
                        >
                            <Text style={styles.sourceCancelText}>Batal</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ========== Alert Bottom Sheet ========== */}
            <Modal
                visible={alertVisible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={closeAlert}
            >
                <View style={styles.alertOverlay}>
                    <TouchableWithoutFeedback onPress={closeAlert}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>

                    <View style={styles.alertSheet}>
                        <TouchableOpacity
                            onPress={closeAlert}
                            style={styles.alertClose}
                        >
                            <Ionicons name="close" size={24} color="#1c1c1c" />
                        </TouchableOpacity>

                        <Text style={styles.alertTitle}>{alertTitle}</Text>
                        <Text style={styles.alertMessage}>{alertMessage}</Text>

                        <TouchableOpacity
                            onPress={() => {
                                const fn = alertAction;
                                closeAlert();
                                if (fn) setTimeout(fn, 200);
                            }}
                            style={styles.alertButton}
                        >
                            <Text style={styles.alertButtonText}>
                                {alertActionLabel}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        gap: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    headerSub: { fontSize: 12, color: colors.primary },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 13, color: colors.textMuted },

    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
    },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

    msgRow: { flexDirection: 'row' },
    msgRowMine: { justifyContent: 'flex-end' },
    msgRowTheirs: { justifyContent: 'flex-start' },
    bubble: {
        maxWidth: '80%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    bubbleImage: {
        padding: 4,
        overflow: 'hidden',
    },
    bubbleMine: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
        backgroundColor: '#F1F3F5',
        borderBottomLeftRadius: 4,
    },
    msgText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    msgTime: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 4,
        textAlign: 'right',
    },

    imageMsg: {
        width: 220,
        height: 220,
        borderRadius: 14,
        backgroundColor: '#eee',
    },
    imageTimeWrap: {
        position: 'absolute',
        right: 8,
        bottom: 6,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    imageTime: { color: '#fff', fontSize: 10, fontWeight: '600' },

    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        backgroundColor: '#fff',
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1F3F5',
    },
    input: {
        flex: 1,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.text,
        backgroundColor: '#F7F9FB',
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

const styles = StyleSheet.create({
    // ---- Loading modal ----
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        width: 100,
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    loadingLabel: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 10,
        textAlign: 'center',
    },

    // ---- Source picker modal ----
    sourceOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sourceSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 32,
    },
    sourceHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#c9ccd1',
        alignSelf: 'center',
        marginBottom: 16,
    },
    sourceTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 16,
    },
    sourceOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    sourceIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primarySoft ?? '#E9F9EF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sourceOptionLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
    sourceOptionSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    sourceCancel: {
        marginTop: 12,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F1F3F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sourceCancelText: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },

    // ---- Alert bottom sheet ----
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    alertSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 50,
        position: 'relative',
    },
    alertClose: {
        position: 'absolute',
        right: 24,
        top: -64,
        backgroundColor: '#fff',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 5,
    },
    alertTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 10,
    },
    alertMessage: {
        fontSize: 15,
        color: '#555',
        lineHeight: 22,
        marginBottom: 32,
    },
    alertButton: {
        width: '100%',
        borderRadius: 100,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: colors.primary,
    },
    alertButtonText: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: 16,
    },
});