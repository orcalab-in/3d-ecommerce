import { Card, Text, colors, radii, spacing } from '@neo-design-library/mobile';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Product } from '@/types/catalog';
import { formatCurrency } from '@/utils/format';

interface Props {
    product: Product;
    onPress: () => void;
}

export default function ProductCard({ product, onPress }: Props) {
    return (
        <Pressable onPress={onPress} style={styles.wrap}>
            <Card style={styles.card}>
                <View style={styles.thumb}>
                    {product.previewImageUrl ? (
                        <Image source={{ uri: product.previewImageUrl }} style={styles.image} contentFit="cover" />
                    ) : (
                        <Text variant="caption" style={styles.placeholder}>
                            3D Model
                        </Text>
                    )}
                </View>
                <Text variant="body" numberOfLines={1} style={styles.name}>
                    {product.name}
                </Text>
                <View style={styles.row}>
                    <Text variant="body" style={styles.price}>
                        {formatCurrency(product.basePrice)}
                    </Text>
                    <Text variant="caption" style={styles.weight}>
                        {product.weightGrams} g
                    </Text>
                </View>
                {product.status === 'out_of_stock' && (
                    <Text variant="caption" style={styles.oos}>
                        Out of stock
                    </Text>
                )}
            </Card>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, padding: spacing[1] },
    card: { padding: spacing[2], gap: spacing[1] },
    thumb: {
        aspectRatio: 1,
        borderRadius: radii.md,
        backgroundColor: colors.bgBase,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    image: { width: '100%', height: '100%' },
    placeholder: { color: colors.textTertiary },
    name: { marginTop: spacing[1] },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    price: { color: colors.violet300, fontWeight: '700' },
    weight: { color: colors.textTertiary },
    oos: { color: colors.textTertiary },
});
