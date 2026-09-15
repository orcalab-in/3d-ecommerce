import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import type { Category, Page } from '../types';

export default function Categories() {
    const qc = useQueryClient();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [error, setError] = useState<string | null>(null);

    const categories = useQuery({ queryKey: ['admin-categories'], queryFn: () => api.get<Page<Category>>('/v1/categories?limit=200') });

    const create = useMutation({
        mutationFn: () => api.post('/v1/categories', { name, slug }),
        onSuccess: () => {
            setName('');
            setSlug('');
            qc.invalidateQueries({ queryKey: ['admin-categories'] });
        },
        onError: (e: any) => setError(e?.message ?? 'Failed'),
    });

    const remove = useMutation({
        mutationFn: (id: string) => api.delete(`/v1/categories/${id}`),
        onSettled: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
    });

    return (
        <div>
            <div className="page-header">
                <h2>Categories</h2>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="toolbar">
                    <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 200 }} />
                    <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} style={{ width: 200 }} />
                    <button onClick={() => create.mutate()} disabled={!name || !slug || create.isPending}>
                        Add
                    </button>
                </div>
                {error && <p className="error">{error}</p>}
            </div>

            <div className="card">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Slug</th>
                            <th>Order</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.data?.items.map((c) => (
                            <tr key={c.id}>
                                <td>{c.name}</td>
                                <td>{c.slug}</td>
                                <td>{c.sort_order}</td>
                                <td>
                                    <button className="danger" onClick={() => remove.mutate(c.id)}>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
