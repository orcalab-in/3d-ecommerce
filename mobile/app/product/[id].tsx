/**
 * Model detail + customisation.
 *   • pick up to min(product.maxColors, 4) colors
 *   • set width/depth/height, clamped to the Bambu Lab A1 build volume
 *   • see print time, production queue, and delivery ETA before adding to cart
 */
import { Button, Card, Text, colors, radii, spacing } from '@neo-design-library/mobile';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { useAddToCartMutation } from '@/hooks/useCartQuery';
import { useCheckDeliveryMutation, usePrintQueueQuery } from '@/hooks/useDeliveryQuery';
import { useProductQuery } from '@/hooks/useProductsQuery';
import { BUILD_LIMITS } from '@/types/catalog';
import type { DeliveryCheck } from '@/types/commerce';
import { formatCurrency, formatMinutes } from '@/utils/format';

export default function ProductDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { data: product, isLoading } = useProductQuery(id ?? '');
    const { data: queue } = usePrintQueueQuery();
    const addToCart = useAddToCartMutation();
    const checkDelivery = useCheckDeliveryMutation();

    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [quantity, setQuantity] = useState(1);
    const [width, setWidth] = useState('');
    const [depth, setDepth] = useState('');
    const [height, setHeight] = useState('');
    const [pincode, setPincode] = useState('');
    const [delivery, setDelivery] = useState<DeliveryCheck | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (product) {
            setWidth(product.widthMm ? String(product.widthMm) : '');
            setDepth(product.depthMm ? String(product.depthMm) : '');
            setHeight(product.heightMm ? String(product.heightMm) : '');
        }
    }, [product?.id]);

    if (isLoading || !product) {
        return (
            <SafeAreaView style={styles.safe}>
                <ActivityIndicator color={colors.violet400} style={{ marginTop: spacing[6] }} />
            </SafeAreaView>
        );
    }

    const maxColors = Math.min(product.maxColors, BUILD_LIMITS.maxColors);

    const toggleColor = (colorId: string) => {
        setSelectedColors((prev) => {
            if (prev.includes(colorId)) return prev.filter((c) => c !== colorId);
            if (prev.length >= maxColors) return prev;
            return [...prev, colorId];
        });
    };

    const clamp = (value: string, limit: number) => {
        const n = parseFloat(value);
        if (Number.isNaN(n)) return undefined;
        return Math.min(n, limit);
    };

    const exceeds = (value: string, limit: number) => {
        const n = parseFloat(value);
        return !Number.isNaN(n) && n > limit;
    };

    const sizeError =
        exceeds(width, BUILD_LIMITS.widthMm) ||
        exceeds(depth, BUILD_LIMITS.depthMm) ||
        exceeds(height, BUILD_LIMITS.heightMm);

    const handleAdd = async () => {
        setError(null);
        if (sizeError) {
            setError('Size exceeds the Bambu Lab A1 build volume (256 mm).');
            return;
        }
        try {
            await addToCart.mutateAsync({
                productId: product.id,
                quantity,
                selectedColorIds: selectedColors,
                widthMm: clamp(width, BUILD_LIMITS.widthMm),
                depthMm: clamp(depth, BUILD_LIMITS.depthMm),
                heightMm: clamp(height, BUILD_LIMITS.heightMm),
            });
            router.push('/(tabs)/cart');
        } catch (e: any) {
            setError(e?.message ?? 'Could not add to cart');
        }
    };

    const handleCheckDelivery = async () => {
        if (pincode.length < 3) return;
        const result = await checkDelivery.mutateAsync(pincode);
        setDelivery(result);
    };

    return (
        <SafeAreaView style={styles.safe}>
            <Stack.Screen options={{ headerShown: true, title: product.name }} />
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.hero}>
                    {product.previewImageUrl ? (
                        <Image source={{ uri: product.previewImageUrl }} style={styles.heroImage} contentFit="cover" />
                    ) : (
                        <Text variant="body" style={{ color: colors.textTertiary }}>
                            3D Model preview
                        </Text>
                    )}
                </View>

                <Text variant="h2">{product.name}</Text>
                <Text variant="h3" style={styles.price}>
                    {formatCurrency(product.basePrice)}
                </Text>
                <Text variant="caption" style={styles.meta}>
                    {product.weightGrams} g · prints in {formatMinutes(product.estPrintMinutes)}
                </Text>
                {product.description ? <Text variant="body" style={styles.desc}>{product.description}</Text> : null}

                {queue && (
                    <Card style={styles.queueCard}>
                        <Text variant="caption" style={{ color: colors.textTertiary }}>
                            Production queue
                        </Text>
                        <Text variant="body">
                            {queue.printing} printing now · {queue.queued} in queue
                        </Text>
                        <Text variant="caption" style={{ color: colors.textTertiary }}>
                            Estimated wait ~{formatMinutes(queue.estWaitMinutes)}
                        </Text>
                    </Card>
                )}

                <Text variant="body" style={styles.sectionTitle}>
                    Colors {maxColors > 1 ? `(up to ${maxColors})` : ''}
                </Text>
                <View style={styles.swatchRow}>
                    {product.colors.length === 0 && (
                        <Text variant="caption" style={{ color: colors.textTertiary }}>
                            Default color
                        </Text>
                    )}
                    {product.colors.map((c) => {
                        const selected = selectedColors.includes(c.id);
                        return (
                            <Pressable key={c.id} onPress={() => toggleColor(c.id)} style={styles.swatchWrap}>
                                <View
                                    style={[
                                        styles.swatch,
                                        { backgroundColor: c.hexCode },
                                        selected && styles.swatchSelected,
                                    ]}
                                />
                                <Text variant="caption" style={styles.swatchLabel}>
                                    {c.name}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Text variant="body" style={styles.sectionTitle}>
                    Size (mm) · max {BUILD_LIMITS.widthMm}×{BUILD_LIMITS.depthMm}×{BUILD_LIMITS.heightMm}
                </Text>
                <View style={styles.sizeRow}>
                    <SizeInput label="Width" value={width} onChange={setWidth} max={BUILD_LIMITS.widthMm} />
                    <SizeInput label="Depth" value={depth} onChange={setDepth} max={BUILD_LIMITS.depthMm} />
                    <SizeInput label="Height" value={height} onChange={setHeight} max={BUILD_LIMITS.heightMm} />
                </View>
                {sizeError && (
                    <Text variant="caption" style={styles.error}>
                        Exceeds the build volume limit.
                    </Text>
                )}

                <Text variant="body" style={styles.sectionTitle}>
                    Quantity
                </Text>
                <View style={styles.qtyRow}>
                    <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={styles.qtyBtn}>
                        <Text variant="h3">−</Text>
                    </Pressable>
                    <Text variant="h3">{quantity}</Text>
                    <Pressable onPress={() => setQuantity((q) => q + 1)} style={styles.qtyBtn}>
                        <Text variant="h3">+</Text>
                    </Pressable>
                </View>

                <Text variant="body" style={styles.sectionTitle}>
                    Delivery
                </Text>
                <View style={styles.deliveryRow}>
                    <TextInput
                        placeholder="Pincode"
                        placeholderTextColor={colors.textTertiary}
                        value={pincode}
                        onChangeText={setPincode}
                        keyboardType="number-pad"
                        style={[styles.input, { flex: 1 }]}
                    />
                    <Button variant="secondary" onPress={handleCheckDelivery}>
                        Check
                    </Button>
                </View>
                {delivery && (
                    <Text variant="caption" style={{ color: delivery.serviceable ? colors.violet300 : colors.textTertiary }}>
                        {delivery.serviceable
                            ? `Delivers to ${delivery.city} in ~${delivery.etaDays} days`
                            : 'Not serviceable at this pincode'}
                    </Text>
                )}

                {error && (
                    <Text variant="caption" style={styles.error}>
                        {error}
                    </Text>
                )}

                <Button variant="primary" onPress={handleAdd} disabled={addToCart.isPending} style={styles.addBtn}>
                    {addToCart.isPending ? 'Adding…' : 'Add to cart'}
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
}

function SizeInput({
    label,
    value,
    onChange,
    max,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    max: number;
}) {
    return (
        <View style={styles.sizeInputWrap}>
            <Text variant="caption" style={{ color: colors.textTertiary }}>
                {label}
            </Text>
            <TextInput
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                placeholder={`≤${max}`}
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    scroll: { padding: spacing[4], gap: spacing[2] },
    hero: {
        aspectRatio: 1,
        borderRadius: radii.lg,
        backgroundColor: colors.bgElevated,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: spacing[2],
    },
    heroImage: { width: '100%', height: '100%' },
    price: { color: colors.violet300 },
    meta: { color: colors.textTertiary },
    desc: { marginTop: spacing[2] },
    queueCard: { padding: spacing[3], marginTop: spacing[3], gap: spacing[1] },
    sectionTitle: { marginTop: spacing[4], fontWeight: '700' },
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginTop: spacing[2] },
    swatchWrap: { alignItems: 'center', gap: spacing[1] },
    swatch: { width: 40, height: 40, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border },
    swatchSelected: { borderColor: colors.violet300, borderWidth: 3 },
    swatchLabel: { color: colors.textTertiary },
    sizeRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
    sizeInputWrap: { flex: 1, gap: spacing[1] },
    input: {
        backgroundColor: colors.bgElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
    },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], marginTop: spacing[2] },
    qtyBtn: {
        width: 44,
        height: 44,
        borderRadius: radii.md,
        backgroundColor: colors.bgElevated,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deliveryRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center', marginTop: spacing[2] },
    error: { color: '#F87171', marginTop: spacing[2] },
    addBtn: { marginTop: spacing[5], marginBottom: spacing[6] },
});
