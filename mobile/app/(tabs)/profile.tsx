/** Profile — account details, address book, custom uploads, sign out. */
import { Button, Card, Text, colors, radii, spacing } from '@neo-design-library/mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useAuthContext } from '@/context/AuthContext';
import { useAddressesQuery, useDeleteAddressMutation } from '@/hooks/useAddressesQuery';
import { api } from '@/services/api';

export default function ProfileScreen() {
    const router = useRouter();
    const { user, signOut, refreshUser } = useAuthContext();
    const { data: addresses = [] } = useAddressesQuery();
    const deleteAddress = useDeleteAddressMutation();

    const [name, setName] = useState(user?.name ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.patch('/v1/users/me', { name, phone });
            await refreshUser();
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text variant="h2">Profile</Text>

                <Card style={styles.card}>
                    <Text variant="caption" style={styles.label}>
                        Email
                    </Text>
                    <Text variant="body">{user?.email}</Text>

                    <Text variant="caption" style={styles.label}>
                        Name
                    </Text>
                    <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.textTertiary} />

                    <Text variant="caption" style={styles.label}>
                        Phone
                    </Text>
                    <TextInput
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        style={styles.input}
                        placeholderTextColor={colors.textTertiary}
                    />

                    <Button variant="secondary" onPress={handleSave} disabled={saving} style={{ marginTop: spacing[2] }}>
                        {saving ? 'Saving…' : 'Save profile'}
                    </Button>
                </Card>

                <View style={styles.sectionHeader}>
                    <Text variant="h3">Addresses</Text>
                    <Pressable onPress={() => router.push('/address/new')}>
                        <Text variant="body" style={{ color: colors.violet300 }}>
                            + Add
                        </Text>
                    </Pressable>
                </View>
                {addresses.length === 0 ? (
                    <Text variant="caption" style={{ color: colors.textTertiary }}>
                        No saved addresses.
                    </Text>
                ) : (
                    addresses.map((a) => (
                        <Card key={a.id} style={styles.card}>
                            <Text variant="body">
                                {a.label} · {a.recipientName} {a.isDefault ? '(default)' : ''}
                            </Text>
                            <Text variant="caption" style={{ color: colors.textTertiary }}>
                                {a.line1}, {a.city}, {a.state} - {a.pincode}
                            </Text>
                            <Pressable onPress={() => deleteAddress.mutate(a.id)}>
                                <Text variant="caption" style={styles.remove}>
                                    Remove
                                </Text>
                            </Pressable>
                        </Card>
                    ))
                )}

                <Button variant="secondary" onPress={() => router.push('/upload')} style={{ marginTop: spacing[4] }}>
                    Upload your own STL
                </Button>

                <Button variant="danger" onPress={signOut} style={{ marginTop: spacing[3], marginBottom: spacing[6] }}>
                    Sign out
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    scroll: { padding: spacing[4], gap: spacing[3] },
    card: { padding: spacing[3], gap: spacing[1] },
    label: { color: colors.textTertiary, marginTop: spacing[2] },
    input: {
        backgroundColor: colors.bgBase,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing[3],
    },
    remove: { color: '#F87171', marginTop: spacing[1] },
});
