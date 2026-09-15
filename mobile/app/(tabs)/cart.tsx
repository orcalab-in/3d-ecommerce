/** Cart — review items, adjust quantity, proceed to checkout. */
import { Button, Card, Text, colors, radii, spacing } from '@neo-design-library/mobile';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import {
    useCartQuery,
    useRemoveCartItemMutation,
    useUpdateCartItemMutation,
} from '@/hooks/useCartQuery';
import { formatCurrency } from '@/utils/format';

export default function CartScreen() {
    const router = useRouter();
    const { data: cart, isLoading } = useCartQuery();
    const updateItem = useUpdateCartItemMutation();
    const removeItem = useRemoveCartItemMutation();

    const items = cart?.items ?? [];

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Text variant="h2">Cart</Text>
            </View>

            {isLoading ? (
                <ActivityIndicator color={colors.violet400} style={{ marginTop: spacing[6] }} />
            ) : items.length === 0 ? (
                <Text variant="body" style={styles.empty}>
                    Your cart is empty.
                </Text>
            ) : (
                <ScrollView contentContainerStyle={styles.scroll}>
                    {items.map((it) => (
                        <Card key={it.id} style={styles.card}>
                            <View style={styles.cardRow}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="body">Model · {formatCurrency(it.unitPrice)}</Text>
                                    <Text variant="caption" style={{ color: colors.textTertiary }}>
                                        {it.selectedColorIds.length} color(s)
                                        {it.heightMm ? ` · ${it.heightMm}mm tall` : ''}
                                    </Text>
                                </View>
                                <View style={styles.qtyRow}>
                                    <Pressable
                                        onPress={() =>
                                            updateItem.mutate({ id: it.id, quantity: Math.max(1, it.quantity - 1) })
                                        }
                                        style={styles.qtyBtn}
                                    >
                                        <Text variant="body">−</Text>
                                    </Pressable>
                                    <Text variant="body">{it.quantity}</Text>
                                    <Pressable
                                        onPress={() => updateItem.mutate({ id: it.id, quantity: it.quantity + 1 })}
                                        style={styles.qtyBtn}
                                    >
                                        <Text variant="body">+</Text>
                                    </Pressable>
                                </View>
                            </View>
                            <Pressable onPress={() => removeItem.mutate(it.id)}>
                                <Text variant="caption" style={styles.remove}>
                                    Remove
                                </Text>
                            </Pressable>
                        </Card>
                    ))}
                </ScrollView>
            )}

            {items.length > 0 && (
                <View style={styles.footer}>
                    <View style={styles.totalRow}>
                        <Text variant="body">Subtotal</Text>
                        <Text variant="h3">{formatCurrency(cart?.subtotal ?? 0)}</Text>
                    </View>
                    <Button variant="primary" onPress={() => router.push('/checkout')}>
                        Checkout
                    </Button>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    header: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
    scroll: { padding: spacing[4], gap: spacing[3] },
    card: { padding: spacing[3], gap: spacing[2] },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
    qtyBtn: {
        width: 36,
        height: 36,
        borderRadius: radii.sm,
        backgroundColor: colors.bgBase,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    remove: { color: '#F87171' },
    empty: { textAlign: 'center', marginTop: spacing[6], color: colors.textTertiary },
    footer: {
        padding: spacing[4],
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: spacing[3],
        backgroundColor: colors.bgElevated,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
