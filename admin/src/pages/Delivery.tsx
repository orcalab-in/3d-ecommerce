import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import type { ServiceablePincode } from '../types';

export default function Delivery() {
    const qc = useQueryClient();
    const [form, setForm] = useState({ pincode: '', city: '', state: '', eta_days: '5' });
    const [error, setError] = useState<string | null>(null);

    const pincodes = useQuery({
        queryKey: ['admin-pincodes'],
        queryFn: () => api.get<ServiceablePincode[]>('/v1/delivery/pincodes'),
    });

    const create = useMutation({
        mutationFn: () =>
            api.post('/v1/delivery/pincodes', {
                pincode: form.pincode,
                city: form.city,
                state: form.state,
                eta_days: Number(form.eta_days) || 5,
            }),
        onSuccess: () => {
            setForm({ pincode: '', city: '', state: '', eta_days: '5' });
            qc.invalidateQueries({ queryKey: ['admin-pincodes'] });
        },
        onError: (e: any) => setError(e?.message ?? 'Failed'),
    });

    const remove = useMutation({
        mutationFn: (id: string) => api.delete(`/v1/delivery/pincodes/${id}`),
        onSettled: () => qc.invalidateQueries({ queryKey: ['admin-pincodes'] }),
    });

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    return (
        <div>
            <div className="page-header">
                <h2>Serviceable pincodes</h2>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="toolbar">
                    <input placeholder="Pincode" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} style={{ width: 120 }} />
                    <input placeholder="City" value={form.city} onChange={(e) => set('city', e.target.value)} style={{ width: 160 }} />
                    <input placeholder="State" value={form.state} onChange={(e) => set('state', e.target.value)} style={{ width: 160 }} />
                    <input placeholder="ETA days" value={form.eta_days} onChange={(e) => set('eta_days', e.target.value)} style={{ width: 90 }} />
                    <button onClick={() => create.mutate()} disabled={!form.pincode || !form.city || create.isPending}>
                        Add
                    </button>
                </div>
                {error && <p className="error">{error}</p>}
            </div>

            <div className="card">
                <table>
                    <thead>
                        <tr>
                            <th>Pincode</th>
                            <th>City</th>
                            <th>State</th>
                            <th>ETA</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {pincodes.data?.map((p) => (
                            <tr key={p.id}>
                                <td>{p.pincode}</td>
                                <td>{p.city}</td>
                                <td>{p.state}</td>
                                <td>{p.eta_days} days</td>
                                <td>
                                    <button className="danger" onClick={() => remove.mutate(p.id)}>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {pincodes.data && pincodes.data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="muted">
                                    No serviceable pincodes yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
