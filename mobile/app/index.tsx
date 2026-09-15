import { Redirect } from 'expo-router';

// Entry point: AuthGate in _layout.tsx handles the real redirect once auth
// state resolves. This just sends the initial route into the app.
export default function Index() {
    return <Redirect href="/(tabs)" />;
}
