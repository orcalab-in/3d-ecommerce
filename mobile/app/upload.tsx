/**
 * Upload a custom STL and get an instant print price.
 *
 * Volume-based estimate: weight = volume × filament density; the price is then
 * material + electricity + labor + margin (computed server-side at /v1/pricing/quote).
 */
import { Button, Card, Text, colors, radii, spacing } from '@neo-design-library/mobile';
import * as DocumentPicker from 'expo-document-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useCreateUploadMutation, useQuoteMutation } from '@/hooks/usePricingQuery';
import type { Quote } from '@/types/commerce';
import { formatCurrency, formatMinutes } from '@/utils/format';

export default function UploadScreen() {
    const quote = useQuoteMutation();
    const createUpload = useCreateUploadMutation();

    const [fileName, setFileName] = useState<string | null>(null);
    const [volume, setVolume] = useState('');
    const [unit, setUnit] = useState<'mm' | 'inch'>('mm');
    const [result, setResult] = useState<Quote | null>(null);
    const [saved, setSaved] = useState(false);

    const pickFile = async () => {
        const res = await DocumentPicker.getDocumentAsync({
            type: ['application/sla', 'application/octet-stream', '*/*'],
            copyToCacheDirectory: false,
        });
        if (!res.canceled && res.assets?.length) {
            setFileName(res.assets[0].name);
            setSaved(false);
        }
    };

    const getQuote = async () => {
        const vol = parseFloat(volume);
        if (Number.isNaN(vol) || vol <= 0) return;
        const q = await quote.mutateAsync({ volumeCm3: vol });
        setResult(q);
    };

    const saveUpload = async () => {
        if (!fileName) return;
        const vol = parseFloat(volume);
        await createUpload.mutateAsync({
            fileName,
            fileUnit: unit,
            volumeCm3: Number.isNaN(vol) ? undefined : vol,
        });
        setSaved(true);
    };

    return (
        <SafeAreaView style={styles.safe}>
            <Stack.Screen options={{ headerShown: true, title: 'Custom print' }} />
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text variant="h2">Upload your model</Text>
                <Text variant="caption" style={{ color: colors.textTertiary }}>
                    Supported: STL, OBJ, STP, STEP, IGS, IGES
                </Text>

                <Pressable onPress={pickFile} style={styles.dropzone}>
                    <Text variant="body" style={{ color: colors.violet300 }}>
                        {fileName ?? 'Tap to choose a 3D model file'}
                    </Text>
                </Pressable>

                <Text variant="caption" style={styles.label}>
                    File unit
                </Text>
                <View style={styles.unitRow}>
                    {(['mm', 'inch'] as const).map((u) => (
                        <Pressable key={u} onPress={() => setUnit(u)} style={[styles.unit, unit === u && styles.unitOn]}>
                            <Text variant="caption" style={{ color: unit === u ? colors.textPrimary : colors.textTertiary }}>
                                {u.toUpperCase()}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Text variant="caption" style={styles.label}>
                    Model volume (cm³)
                </Text>
                <TextInput
                    value={volume}
                    onChangeText={setVolume}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 32.5"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.input}
                />

                <Button variant="secondary" onPress={getQuote} disabled={quote.isPending} style={{ marginTop: spacing[3] }}>
                    {quote.isPending ? 'Calculating…' : 'Calculate price'}
                </Button>

                {result && (
                    <Card style={styles.quote}>
                        <Text variant="h3">{formatCurrency(result.unitPrice)}</Text>
                        <Text variant="caption" style={{ color: colors.textTertiary }}>
                            ~{result.weightGrams} g · prints in {formatMinutes(result.printMinutes)}
                        </Text>
                        <View style={styles.divider} />
                        <Row label="Material" value={formatCurrency(result.materialCost)} />
                        <Row label="Electricity" value={formatCurrency(result.electricityCost)} />
                        <Row label="Labor" value={formatCurrency(result.laborCost)} />
                        <Row label="Margin" value={formatCurrency(result.margin)} />
                        <Button variant="primary" onPress={saveUpload} disabled={createUpload.isPending} style={{ marginTop: spacing[3] }}>
                            {saved ? 'Saved' : createUpload.isPending ? 'Saving…' : 'Save quote'}
                        </Button>
                    </Card>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.row}>
            <Text variant="caption" style={{ color: colors.textTertiary }}>
                {label}
            </Text>
            <Text variant="caption">{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    scroll: { padding: spacing[4], gap: spacing[2] },
    dropzone: {
        marginTop: spacing[3],
        padding: spacing[5],
        borderRadius: radii.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
        alignItems: 'center',
    },
    label: { color: colors.textTertiary, marginTop: spacing[3] },
    unitRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
    unit: {
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
    },
    unitOn: { backgroundColor: colors.violet400, borderColor: colors.violet400 },
    input: {
        backgroundColor: colors.bgElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        marginTop: spacing[1],
    },
    quote: { padding: spacing[3], gap: spacing[1], marginTop: spacing[4], marginBottom: spacing[6] },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[2] },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
});
