/** Orders — order history with a status tracker. */
import { Button, Card, Text, colors, radii, spacing } from '@neo-design-library/mobile';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { useCancelOrderMutation, useOrdersQuery } from '@/hooks/useOrdersQuery';
import type { OrderStatus } from '@/types/commerce';
import { formatCurrency } from '@/utils/format';

const STAGES: OrderStatus[] = ['confirmed', 'printing', 'shipped', 'delivered'];
const STAGE_LABEL: Record<OrderStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    printing: 'Printing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

export default function OrdersScreen() {
    const { data: orders = [], isLoading } = useOrdersQuery();
    const cancelOrder = useCancelOrderMutation();

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Text variant="h2">Orders</Text>
            </View>
            {isLoading ? (
                <ActivityIndicator color={colors.violet400} style={{ marginTop: spacing[6] }} />
            ) : orders.length === 0 ? (
                <Text variant="body" style={styles.empty}>
                    No orders yet.
                </Text>
            ) : (
                <ScrollView contentContainerStyle={styles.scroll}>
                    {orders.map((o) => {
                        const cancelled = o.status === 'cancelled';
                        const currentStage = STAGES.indexOf(o.status);
                        return (
                            <Card key={o.id} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Text variant="body">Order #{o.id.slice(0, 8)}</Text>
                                    <Text variant="body" style={styles.total}>
                                        {formatCurrency(o.total)}
                                    </Text>
                                </View>
                                <Text variant="caption" style={{ color: colors.textTertiary }}>
                                    {o.items.length} item(s)
                                    {o.expectedDeliveryDate ? ` · arrives by ${o.expectedDeliveryDate}` : ''}
                                </Text>

                                {cancelled ? (
                                    <Text variant="caption" style={styles.cancelled}>
                                        Cancelled
                                    </Text>
                                ) : (
                                    <View style={styles.tracker}>
                                        {STAGES.map((stage, idx) => {
                                            const done = idx <= currentStage;
                                            return (
                                                <View key={stage} style={styles.stage}>
                                                    <View style={[styles.dot, done && styles.dotActive]} />
                                                    <Text
                                                        variant="caption"
                                                        style={{ color: done ? colors.violet300 : colors.textTertiary }}
                                                    >
                                                        {STAGE_LABEL[stage]}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}

                                {!cancelled && o.status !== 'delivered' && o.status !== 'shipped' && (
                                    <Button variant="ghost" onPress={() => cancelOrder.mutate(o.id)}>
                                        Cancel order
                                    </Button>
                                )}
                            </Card>
                        );
                    })}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    header: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
    scroll: { padding: spacing[4], gap: spacing[3] },
    card: { padding: spacing[3], gap: spacing[2] },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    total: { color: colors.violet300 },
    tracker: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[2] },
    stage: { alignItems: 'center', gap: spacing[1], flex: 1 },
    dot: {
        width: 12,
        height: 12,
        borderRadius: radii.lg,
        backgroundColor: colors.bgBase,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dotActive: { backgroundColor: colors.violet400, borderColor: colors.violet400 },
    cancelled: { color: '#F87171' },
    empty: { textAlign: 'center', marginTop: spacing[6], color: colors.textTertiary },
});
