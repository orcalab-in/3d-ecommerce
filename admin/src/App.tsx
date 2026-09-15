import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Categories from './pages/Categories';
import Colors from './pages/Colors';
import Delivery from './pages/Delivery';
import Orders from './pages/Orders';
import Pricing from './pages/Pricing';
import PrintQueue from './pages/PrintQueue';
import Products from './pages/Products';

const NAV = [
    { to: '/products', label: 'Products' },
    { to: '/categories', label: 'Categories' },
    { to: '/colors', label: 'Colors' },
    { to: '/orders', label: 'Orders' },
    { to: '/queue', label: 'Print Queue' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/delivery', label: 'Delivery' },
];

function Layout() {
    const { user, signOut } = useAuth();
    return (
        <div className="layout">
            <aside className="sidebar">
                <h1>3D Print Admin</h1>
                {NAV.map((n) => (
                    <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        {n.label}
                    </NavLink>
                ))}
                <div style={{ marginTop: 'auto' }}>
                    <p className="muted">{user?.email}</p>
                    <button className="ghost" onClick={signOut}>
                        Sign out
                    </button>
                </div>
            </aside>
            <main className="content">
                <Outlet />
            </main>
        </div>
    );
}

export default function App() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <div className="login-wrap">Loading…</div>;
    }
    if (!user) {
        return <Login />;
    }

    return (
        <Routes>
            <Route element={<Layout />}>
                <Route path="/products" element={<Products />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/colors" element={<Colors />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/queue" element={<PrintQueue />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/delivery" element={<Delivery />} />
                <Route path="*" element={<Navigate to="/products" replace />} />
            </Route>
        </Routes>
    );
}
