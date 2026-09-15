/** Shop — browse the 3D-print model catalog with search, categories and sort. */
import { Text, colors, radii, spacing } from '@neo-design-library/mobile';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import ProductCard from '@/components/product-card';
import { useCategoriesQuery, useProductsQuery, type ProductSort } from '@/hooks/useProductsQuery';
import { usePrintQueueQuery } from '@/hooks/useDeliveryQuery';
import { formatMinutes } from '@/utils/format';

const SORTS: { id: ProductSort; label: string }[] = [
    { id: 'newest', label: 'Newest' },
    { id: 'featured', label: 'Featured' },
    { id: 'price_asc', label: 'Price ↑' },
    { id: 'price_desc', label: 'Price ↓' },
    { id: 'name', label: 'A–Z' },
];

export default function Shop() {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | undefined>();
    const [sort, setSort] = useState<ProductSort>('newest');

    const filters = useMemo(
        () => ({ q: search.trim() || undefined, category: activeCategory, sort }),
        [search, activeCategory, sort],
    );

    const { data: products = [], isLoading } = useProductsQuery(filters);
    const { data: categories = [] } = useCategoriesQuery();
    const { data: queue } = usePrintQueueQuery();

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Text variant="h2">3D Print Shop</Text>
                {queue && (
                    <Text variant="caption" style={styles.queue}>
                        {queue.printing} printing · {queue.queued} queued · ~{formatMinutes(queue.estWaitMinutes)} wait
                    </Text>
                )}
            </View>

            <View style={styles.searchRow}>
                <TextInput
                    placeholder="Search models"
                    placeholderTextColor={colors.textTertiary}
                    value={search}
                    onChangeText={setSearch}
                    style={styles.search}
                />
            </View>

            <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    <Chip label="All" active={!activeCategory} onPress={() => setActiveCategory(undefined)} />
                    {categories.map((c) => (
                        <Chip
                            key={c.id}
                            label={c.name}
                            active={activeCategory === c.slug}
                            onPress={() => setActiveCategory(c.slug)}
                        />
                    ))}
                </ScrollView>
            </View>

            <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {SORTS.map((s) => (
                        <Chip key={s.id} label={s.label} active={sort === s.id} onPress={() => setSort(s.id)} />
                    ))}
                </ScrollView>
            </View>

            {isLoading ? (
                <ActivityIndicator color={colors.violet400} style={styles.loader} />
            ) : (
                <FlatList
                    data={products}
                    keyExtractor={(p) => p.id}
                    numColumns={2}
                    contentContainerStyle={styles.grid}
                    renderItem={({ item }) => (
                        <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
                    )}
                    ListEmptyComponent={<Text variant="body" style={styles.empty}>No models found.</Text>}
                />
            )}
        </SafeAreaView>
    );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
            <Text variant="caption" style={StyleSheet.flatten([styles.chipText, active && styles.chipTextActive])}>
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    header: { paddingHorizontal: spacing[4], paddingTop: spacing[2], gap: spacing[1] },
    queue: { color: colors.textTertiary },
    searchRow: { paddingHorizontal: spacing[4], paddingTop: spacing[3] },
    search: {
        backgroundColor: colors.bgElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
    },
    chips: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], gap: spacing[2] },
    chip: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1],
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
    },
    chipActive: { backgroundColor: colors.violet400, borderColor: colors.violet400 },
    chipText: { color: colors.textTertiary },
    chipTextActive: { color: colors.textPrimary },
    grid: { paddingHorizontal: spacing[3], paddingBottom: spacing[6] },
    loader: { marginTop: spacing[6] },
    empty: { textAlign: 'center', marginTop: spacing[6], color: colors.textTertiary },
});
