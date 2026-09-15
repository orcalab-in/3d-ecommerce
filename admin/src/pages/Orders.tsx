import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Order, OrderStatus, Page } from '../types';

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: 'confirmed',
    confirmed: 'printing',
    printing: 'shipped',
    shipped: 'delivered',
};

export default function Orders() {
    const qc = useQueryClient();
    const orders = useQuery({
        queryKey: ['admin-orders'],
        queryFn: () => api.get<Page<Order>>('/v1/orders?scope=all&limit=200'),
    });

    const advance = useMutation({
        mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
            api.patch(`/v1/orders/${id}/status`, { status }),
        onSettled: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }),
    });

    return (
        <div>
            <div className="page-header">
                <h2>Orders</h2>
            </div>
            <div className="card">
                <table>
                    <thead>
                        <tr>
                            <th>Order</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>ETA</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.data?.items.map((o) => {
                            const next = NEXT[o.status];
                            return (
                                <tr key={o.id}>
                                    <td>#{o.id.slice(0, 8)}</td>
                                    <td>{o.items.length}</td>
                                    <td>₹{o.total}</td>
                                    <td>
                                        <span className={`badge ${o.status}`}>{o.status}</span>
                                    </td>
                                    <td>{o.expected_delivery_date ?? '—'}</td>
                                    <td>
                                        {next && (
                                            <button onClick={() => advance.mutate({ id: o.id, status: next })}>
                                                Mark {next}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {orders.data && orders.data.items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="muted">
                                    No orders.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
