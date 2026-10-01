import React from 'react';
import {
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaterialCommunityIcons } from '@expo/vector-icons';

const GREEN = '#00A82D';
const ORANGE = '#F36C00';
const TEXT = '#222222';
const GRAY = '#777777';

export default function ChatScreen() {
    const openWhatsApp = async () => {
        const phone = '62812285777';
        const url = `https://wa.me/${phone}`;

        try {
            await Linking.openURL(url);
        } catch (error) {
            console.log('Gagal membuka WhatsApp:', error);
        }
    };

    const openInbox = () => {
        console.log('Inbox clicked');
    };

    const openChat = () => {
        console.log('Chat Jeklin clicked');
    };

    const openNewChat = () => {
        console.log('New chat clicked');
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>



                {/* ================= CONTENT ================= */}
                <View style={styles.content}>

                    {/* PILIHAN FITUR */}
                    <Text style={styles.sectionTitle}>Pilihan fitur</Text>

                    <View style={styles.featureRow}>



                        {/* BANTUAN */}
                        <TouchableOpacity
                            style={styles.featureItem}
                            activeOpacity={0.75}
                            onPress={openWhatsApp}
                        >
                            <View
                                style={[
                                    styles.featureIcon,
                                    { backgroundColor: GREEN },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="chat-question"
                                    size={24}
                                    color="#fff"
                                />
                            </View>
                            <Text style={styles.featureLabel}>Bantuan</Text>
                        </TouchableOpacity>

                    </View>





                </View>



            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },

    container: {
        flex: 1,
        backgroundColor: '#fff',
    },

    /* ================= HEADER ================= */

    header: {
        height: 84,
        justifyContent: 'flex-end',
        paddingHorizontal: 25,
        paddingBottom: 25,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },

    headerTitle: {
        fontSize: 25,
        fontWeight: '700',
        color: '#222',
    },

    /* ================= CONTENT ================= */

    content: {
        flex: 1,
        paddingHorizontal: 25,
        paddingTop: 24,
    },

    sectionTitle: {
        fontSize: 20,

        fontWeight: '700',
        color: TEXT,
    },

    featureRow: {
        flexDirection: 'row',
        marginTop: 26,
        gap: 32,
    },

    featureItem: {
        alignItems: 'flex-start',
        width: 80,
    },

    featureIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },

    featureLabel: {
        marginTop: 9,
        fontSize: 17,
        color: '#666',
        fontWeight: '400',
    },

    chatTitle: {
        marginTop: 64,
    },

    /* ================= CHAT ================= */

    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 27,
        minHeight: 70,
    },

    avatarWrapper: {
        width: 64,
        height: 64,
        position: 'relative',
    },

    avatar: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#BDEAF2',
    },

    verifiedBadge: {
        position: 'absolute',
        right: 0,
        bottom: -1,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },

    chatInfo: {
        flex: 1,
        marginLeft: 20,
    },

    chatName: {
        fontSize: 22,
        fontWeight: '600',
        color: '#222',
    },

    chatDate: {
        fontSize: 16,
        color: GRAY,
        marginRight: 2,
        alignSelf: 'flex-start',
        marginTop: 8,
    },

    /* ================= FLOATING BUTTON ================= */

    floatingButton: {
        position: 'absolute',
        right: 28,
        bottom: 120,
        width: 78,
        height: 78,
        borderRadius: 39,
        backgroundColor: GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },
});