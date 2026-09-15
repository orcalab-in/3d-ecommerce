import React from 'react';
import { BottomNavigation } from '@neo-design-library/mobile';
import type { BottomNavItem } from '@neo-design-library/mobile';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Headset, Package, ShoppingCart, Storefront, User } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICON_SIZE = 24;
const ACTIVE = '#A78BFA'; // colors.violet300
const INACTIVE = '#6B6B8A'; // colors.textTertiary

const NAV_ITEMS: { routeName: string; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
        routeName: 'index',
        label: 'Shop',
        icon: (a) => <Storefront size={ICON_SIZE} color={a ? ACTIVE : INACTIVE} weight={a ? 'fill' : 'regular'} />,
    },
    {
        routeName: 'cart',
        label: 'Cart',
        icon: (a) => <ShoppingCart size={ICON_SIZE} color={a ? ACTIVE : INACTIVE} weight={a ? 'fill' : 'regular'} />,
    },
    {
        routeName: 'orders',
        label: 'Orders',
        icon: (a) => <Package size={ICON_SIZE} color={a ? ACTIVE : INACTIVE} weight={a ? 'fill' : 'regular'} />,
    },
    {
        routeName: 'profile',
        label: 'Profile',
        icon: (a) => <User size={ICON_SIZE} color={a ? ACTIVE : INACTIVE} weight={a ? 'fill' : 'regular'} />,
    },
    {
        routeName: 'support',
        label: 'Support',
        icon: (a) => <Headset size={ICON_SIZE} color={a ? ACTIVE : INACTIVE} weight={a ? 'fill' : 'regular'} />,
    },
];

export default function CustomTabs({ state, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    const items: BottomNavItem[] = NAV_ITEMS.map((item) => ({
        id: item.routeName,
        label: item.label,
        icon: item.icon,
    }));

    const activeRoute = state.routes[state.index]?.name ?? 'index';

    return (
        <BottomNavigation
            items={items}
            active={activeRoute}
            safeAreaBottom={insets.bottom}
            onChange={(id) => {
                const route = state.routes.find((r) => r.name === id);
                if (route && route.name !== activeRoute) {
                    navigation.navigate(route.name, route.params);
                }
            }}
        />
    );
}
