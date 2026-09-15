/** Add a delivery address. */
import { Button, Text, colors, radii, spacing } from '@neo-design-library/mobile';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useAddAddressMutation, type AddressInput } from '@/hooks/useAddressesQuery';

const FIELDS: { key: keyof AddressInput; label: string; keyboard?: 'default' | 'phone-pad' | 'number-pad' }[] = [
    { key: 'label', label: 'Label (e.g. Home)' },
    { key: 'recipientName', label: 'Recipient name' },
    { key: 'phone', label: 'Phone', keyboard: 'phone-pad' },
    { key: 'line1', label: 'Address line 1' },
    { key: 'line2', label: 'Address line 2 (optional)' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'pincode', label: 'Pincode', keyboard: 'number-pad' },
];

export default function NewAddress() {
    const router = useRouter();
    const addAddress = useAddAddressMutation();
    const [form, setForm] = useState<Record<string, string>>({ label: 'Home' });
    const [isDefault, setIsDefault] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

    const handleSave = async () => {
        setError(null);
        try {
            await addAddress.mutateAsync({
                label: form.label || 'Home',
                recipientName: form.recipientName ?? '',
                phone: form.phone ?? '',
                line1: form.line1 ?? '',
                line2: form.line2,
                city: form.city ?? '',
                state: form.state ?? '',
                pincode: form.pincode ?? '',
                isDefault,
            });
            router.back();
        } catch (e: any) {
            setError(e?.message ?? 'Could not save address');
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <Stack.Screen options={{ headerShown: true, title: 'New address' }} />
            <ScrollView contentContainerStyle={styles.scroll}>
                {FIELDS.map((f) => (
                    <View key={f.key} style={styles.field}>
                        <Text variant="caption" style={{ color: colors.textTertiary }}>
                            {f.label}
                        </Text>
                        <TextInput
                            value={form[f.key] ?? ''}
                            onChangeText={(v) => set(f.key, v)}
                            keyboardType={f.keyboard ?? 'default'}
                            style={styles.input}
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>
                ))}

                <Pressable onPress={() => setIsDefault((d) => !d)} style={styles.toggle}>
                    <View style={[styles.checkbox, isDefault && styles.checkboxOn]} />
                    <Text variant="body">Set as default</Text>
                </Pressable>

                {error && (
                    <Text variant="caption" style={styles.error}>
                        {error}
                    </Text>
                )}

                <Button variant="primary" onPress={handleSave} disabled={addAddress.isPending} style={{ marginTop: spacing[3] }}>
                    {addAddress.isPending ? 'Saving…' : 'Save address'}
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    scroll: { padding: spacing[4], gap: spacing[2] },
    field: { gap: spacing[1] },
    input: {
        backgroundColor: colors.bgElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
    },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
    },
    checkboxOn: { backgroundColor: colors.violet400, borderColor: colors.violet400 },
    error: { color: '#F87171', marginTop: spacing[2] },
});
