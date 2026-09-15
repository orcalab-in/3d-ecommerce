/** Checkout — choose a delivery address and place the order. */
import { Button, Card, Text, colors, radii, spacing } from '@neo-design-library/mobile';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { useAddressesQuery } from '@/hooks/useAddressesQuery';
import { useCartQuery } from '@/hooks/useCartQuery';
import { useCreateOrderMutation } from '@/hooks/useOrdersQuery';
import { formatCurrency } from '@/utils/format';

const SHIPPING_FEE = 49;

export default function Checkout() {
    const router = useRouter();
    const { data: addresses = [], isLoading } = useAddressesQuery();
    const { data: cart } = useCartQuery();
    const createOrder = useCreateOrderMutation();

    const [selected, setSelected] = useState<string | undefined>();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!selected && addresses.length) {
            setSelected((addresses.find((a) => a.isDefault) ?? addresses[0]).id);
        }
    }, [addresses, selected]);

    const subtotal = cart?.subtotal ?? 0;

    const handlePlace = async () => {
        setError(null);
        if (!selected) {
            setError('Please select a delivery address.');
            return;
        }
        try {
            const order = await createOrder.mutateAsync(selected);
            router.replace(`/(tabs)/orders`);
            return order;
        } catch (e: any) {
            setError(e?.message ?? 'Could not place order');
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <Stack.Screen options={{ headerShown: true, title: 'Checkout' }} />
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text variant="h3">Delivery address</Text>
                {isLoading ? (
                    <ActivityIndicator color={colors.violet400} />
                ) : addresses.length === 0 ? (
                    <View style={styles.empty}>
                        <Text variant="body" style={{ color: colors.textTertiary }}>
                            No saved addresses.
                        </Text>
                        <Button variant="secondary" onPress={() => router.push('/address/new')}>
                            Add address
                        </Button>
                    </View>
                ) : (
                    addresses.map((a) => (
                        <Pressable key={a.id} onPress={() => setSelected(a.id)}>
                            <Card style={StyleSheet.flatten([styles.card, selected === a.id && styles.cardSelected])}>
                                <Text variant="body">
                                    {a.label} · {a.recipientName}
                                </Text>
                                <Text variant="caption" style={{ color: colors.textTertiary }}>
                                    {a.line1}, {a.city}, {a.state} - {a.pincode}
                                </Text>
                            </Card>
                        </Pressable>
                    ))
                )}

                <Text variant="h3" style={{ marginTop: spacing[4] }}>
                    Summary
                </Text>
                <Card style={styles.summary}>
                    <Row label="Subtotal" value={formatCurrency(subtotal)} />
                    <Row label="Shipping" value={formatCurrency(SHIPPING_FEE)} />
                    <Row label="Total" value={formatCurrency(subtotal + SHIPPING_FEE)} bold />
                </Card>

                {error && (
                    <Text variant="caption" style={styles.error}>
                        {error}
                    </Text>
                )}

                <Button
                    variant="primary"
                    onPress={handlePlace}
                    disabled={createOrder.isPending || addresses.length === 0}
                    style={{ marginTop: spacing[4] }}
                >
                    {createOrder.isPending ? 'Placing…' : 'Place order'}
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <View style={styles.row}>
            <Text variant="body">{label}</Text>
            <Text variant={bold ? 'h3' : 'body'}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    scroll: { padding: spacing[4], gap: spacing[2] },
    card: { padding: spacing[3], gap: spacing[1], marginTop: spacing[2] },
    cardSelected: { borderWidth: 2, borderColor: colors.violet300 },
    empty: { gap: spacing[3], marginTop: spacing[2] },
    summary: { padding: spacing[3], gap: spacing[2], marginTop: spacing[2] },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    error: { color: '#F87171', marginTop: spacing[2] },
});
