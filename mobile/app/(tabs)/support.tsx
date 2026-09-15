/** Support — FAQ + contact. */
import { Button, Card, Text, colors, spacing } from '@neo-design-library/mobile';
import { Linking, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

const FAQ = [
    {
        q: 'What file formats can I upload?',
        a: 'We support STL, OBJ, STP, STEP, IGS and IGES files for custom 3D prints.',
    },
    {
        q: 'How is the price calculated?',
        a: 'Price = material (weight × filament rate) + electricity + labor, plus a margin.',
    },
    {
        q: 'What is the maximum print size?',
        a: 'Our Bambu Lab A1 supports up to 256 × 256 × 256 mm and up to 4 colors.',
    },
    {
        q: 'How long does printing take?',
        a: 'Each model shows an estimated print time and the live production queue wait.',
    },
];

export default function SupportScreen() {
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text variant="h2">Support</Text>
                <Text variant="body" style={{ color: colors.textTertiary }}>
                    Frequently asked questions
                </Text>

                {FAQ.map((item) => (
                    <Card key={item.q} style={styles.card}>
                        <Text variant="body" style={styles.q}>
                            {item.q}
                        </Text>
                        <Text variant="caption" style={{ color: colors.textTertiary }}>
                            {item.a}
                        </Text>
                    </Card>
                ))}

                <View style={styles.contact}>
                    <Text variant="h3">Still need help?</Text>
                    <Button variant="primary" onPress={() => Linking.openURL('mailto:support@3dprintshop.example')}>
                        Email support
                    </Button>
                    <Button variant="secondary" onPress={() => Linking.openURL('tel:+910000000000')}>
                        Call us
                    </Button>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    scroll: { padding: spacing[4], gap: spacing[2] },
    card: { padding: spacing[3], gap: spacing[1], marginTop: spacing[2] },
    q: { fontWeight: '700' },
    contact: { marginTop: spacing[4], gap: spacing[3], marginBottom: spacing[6] },
});
