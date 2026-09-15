import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import type { Color, Page } from '../types';

export default function Colors() {
    const qc = useQueryClient();
    const [name, setName] = useState('');
    const [hex, setHex] = useState('#');
    const [error, setError] = useState<string | null>(null);

    const colors = useQuery({ queryKey: ['admin-colors'], queryFn: () => api.get<Page<Color>>('/v1/colors?limit=200') });

    const create = useMutation({
        mutationFn: () => api.post('/v1/colors', { name, hex_code: hex }),
        onSuccess: () => {
            setName('');
            setHex('#');
            qc.invalidateQueries({ queryKey: ['admin-colors'] });
        },
        onError: (e: any) => setError(e?.message ?? 'Failed'),
    });

    const toggleStock = useMutation({
        mutationFn: ({ id, inStock }: { id: string; inStock: boolean }) => api.patch(`/v1/colors/${id}`, { in_stock: inStock }),
        onSettled: () => qc.invalidateQueries({ queryKey: ['admin-colors'] }),
    });

    const remove = useMutation({
        mutationFn: (id: string) => api.delete(`/v1/colors/${id}`),
        onSettled: () => qc.invalidateQueries({ queryKey: ['admin-colors'] }),
    });

    return (
        <div>
            <div className="page-header">
                <h2>Color palette</h2>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="toolbar">
                    <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 180 }} />
                    <input placeholder="#RRGGBB" value={hex} onChange={(e) => setHex(e.target.value)} style={{ width: 140 }} />
                    <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#000000'} onChange={(e) => setHex(e.target.value)} style={{ width: 48, padding: 2 }} />
                    <button onClick={() => create.mutate()} disabled={!name || create.isPending}>
                        Add
                    </button>
                </div>
                {error && <p className="error">{error}</p>}
            </div>

            <div className="card">
                <table>
                    <thead>
                        <tr>
                            <th>Color</th>
                            <th>Name</th>
                            <th>Hex</th>
                            <th>Stock</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {colors.data?.items.map((c) => (
                            <tr key={c.id}>
                                <td>
                                    <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 4, background: c.hex_code, border: '1px solid var(--border)' }} />
                                </td>
                                <td>{c.name}</td>
                                <td>{c.hex_code}</td>
                                <td>
                                    <span className={`badge ${c.in_stock ? 'active' : 'out_of_stock'}`}>
                                        {c.in_stock ? 'In stock' : 'Out'}
                                    </span>
                                </td>
                                <td>
                                    <div className="row-actions">
                                        <button className="secondary" onClick={() => toggleStock.mutate({ id: c.id, inStock: !c.in_stock })}>
                                            Toggle stock
                                        </button>
                                        <button className="danger" onClick={() => remove.mutate(c.id)}>
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
