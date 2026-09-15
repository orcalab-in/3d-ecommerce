import CustomTabs from '@/components/custom-tabs';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
    return (
        <Tabs tabBar={(props) => <CustomTabs {...props} />} screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="index" />
            <Tabs.Screen name="cart" />
            <Tabs.Screen name="orders" />
            <Tabs.Screen name="profile" />
            <Tabs.Screen name="support" />
        </Tabs>
    );
}
