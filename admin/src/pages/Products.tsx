import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import type { Category, Color, Page, Product, ProductStatus } from '../types';

const STATUSES: ProductStatus[] = ['draft', 'active', 'out_of_stock', 'archived'];

const EMPTY = {
    name: '',
    slug: '',
    description: '',
    weight_grams: '',
    base_price: '',
    status: 'draft' as ProductStatus,
    preview_image_url: '',
    est_print_minutes: '0',
    max_colors: '1',
    featured: false,
    category_ids: [] as string[],
    color_ids: [] as string[],
};

export default function Products() {
    const qc = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [editing, setEditing] = useState<Product | null>(null);
    const [showForm, setShowForm] = useState(false);

    const products = useQuery({
        queryKey: ['admin-products', statusFilter],
        queryFn: () => api.get<Page<Product>>(`/v1/products?status=${statusFilter}&limit=200`),
    });

    const setStatus = useMutation({
        mutationFn: ({ id, status }: { id: string; status: ProductStatus }) =>
            api.patch(`/v1/products/${id}`, { status }),
        onSettled: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
    });

    const remove = useMutation({
        mutationFn: (id: string) => api.delete(`/v1/products/${id}`),
        onSettled: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
    });

    const openCreate = () => {
        setEditing(null);
        setShowForm(true);
    };
    const openEdit = (p: Product) => {
        setEditing(p);
        setShowForm(true);
    };

    return (
        <div>
            <div className="page-header">
                <h2>Products</h2>
                <button onClick={openCreate}>+ New product</button>
            </div>

            <div className="toolbar">
                <span className="muted">Status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
                    <option value="all">All</option>
                    {STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
            </div>

            <div className="card">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Price</th>
                            <th>Weight</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.data?.items.map((p) => (
                            <tr key={p.id}>
                                <td>{p.name}</td>
                                <td>₹{p.base_price}</td>
                                <td>{p.weight_grams} g</td>
                                <td>
                                    <span className={`badge ${p.status}`}>{p.status}</span>
                                </td>
                                <td>
                                    <div className="row-actions">
                                        <button className="secondary" onClick={() => openEdit(p)}>
                                            Edit
                                        </button>
                                        {p.status !== 'active' && (
                                            <button onClick={() => setStatus.mutate({ id: p.id, status: 'active' })}>
                                                Publish
                                            </button>
                                        )}
                                        {p.status === 'active' && (
                                            <button
                                                className="secondary"
                                                onClick={() => setStatus.mutate({ id: p.id, status: 'out_of_stock' })}
                                            >
                                                Out of stock
                                            </button>
                                        )}
                                        <button
                                            className="ghost"
                                            onClick={() => setStatus.mutate({ id: p.id, status: 'archived' })}
                                        >
                                            Archive
                                        </button>
                                        <button className="danger" onClick={() => remove.mutate(p.id)}>
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {products.data && products.data.items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="muted">
                                    No products.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showForm && <ProductForm product={editing} onClose={() => setShowForm(false)} />}
        </div>
    );
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        ...EMPTY,
        ...(product
            ? {
                  name: product.name,
                  slug: product.slug,
                  description: product.description ?? '',
                  weight_grams: product.weight_grams,
                  base_price: product.base_price,
                  status: product.status,
                  preview_image_url: product.preview_image_url ?? '',
                  est_print_minutes: String(product.est_print_minutes),
                  max_colors: String(product.max_colors),
                  featured: product.featured,
              }
            : {}),
    });
    const [error, setError] = useState<string | null>(null);

    const categories = useQuery({ queryKey: ['admin-categories'], queryFn: () => api.get<Page<Category>>('/v1/categories?limit=200') });
    const colors = useQuery({ queryKey: ['admin-colors'], queryFn: () => api.get<Page<Color>>('/v1/colors?limit=200') });

    const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));
    const toggle = (key: 'category_ids' | 'color_ids', id: string) =>
        setForm((f) => ({
            ...f,
            [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
        }));

    const save = useMutation({
        mutationFn: async () => {
            const body: any = {
                name: form.name,
                slug: form.slug,
                description: form.description || undefined,
                weight_grams: form.weight_grams,
                base_price: form.base_price,
                status: form.status,
                preview_image_url: form.preview_image_url || undefined,
                est_print_minutes: Number(form.est_print_minutes) || 0,
                max_colors: Number(form.max_colors) || 1,
                featured: form.featured,
                category_ids: form.category_ids,
                color_ids: form.color_ids,
            };
            if (product) return api.patch(`/v1/products/${product.id}`, body);
            return api.post('/v1/products', body);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin-products'] });
            onClose();
        },
        onError: (e: any) => setError(e?.message ?? 'Save failed'),
    });

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>{product ? 'Edit product' : 'New product'}</h3>
                <div className="grid-2">
                    <Field label="Name">
                        <input value={form.name} onChange={(e) => set('name', e.target.value)} />
                    </Field>
                    <Field label="Slug">
                        <input value={form.slug} onChange={(e) => set('slug', e.target.value)} />
                    </Field>
                    <Field label="Weight (g)">
                        <input value={form.weight_grams} onChange={(e) => set('weight_grams', e.target.value)} />
                    </Field>
                    <Field label="Base price (INR)">
                        <input value={form.base_price} onChange={(e) => set('base_price', e.target.value)} />
                    </Field>
                    <Field label="Est. print minutes">
                        <input value={form.est_print_minutes} onChange={(e) => set('est_print_minutes', e.target.value)} />
                    </Field>
                    <Field label="Max colors (1–4)">
                        <input value={form.max_colors} onChange={(e) => set('max_colors', e.target.value)} />
                    </Field>
                    <Field label="Status">
                        <select value={form.status} onChange={(e) => set('status', e.target.value as ProductStatus)}>
                            {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Preview image URL">
                        <input value={form.preview_image_url} onChange={(e) => set('preview_image_url', e.target.value)} />
                    </Field>
                </div>
                <Field label="Description">
                    <textarea value={form.description} rows={3} onChange={(e) => set('description', e.target.value)} />
                </Field>

                <Field label="Categories">
                    <div className="row-actions">
                        {categories.data?.items.map((c) => (
                            <label key={c.id} className="badge" style={{ cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    style={{ width: 'auto', marginRight: 6 }}
                                    checked={form.category_ids.includes(c.id)}
                                    onChange={() => toggle('category_ids', c.id)}
                                />
                                {c.name}
                            </label>
                        ))}
                    </div>
                </Field>

                <Field label="Available colors">
                    <div className="row-actions">
                        {colors.data?.items.map((c) => (
                            <label key={c.id} className="badge" style={{ cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    style={{ width: 'auto', marginRight: 6 }}
                                    checked={form.color_ids.includes(c.id)}
                                    onChange={() => toggle('color_ids', c.id)}
                                />
                                {c.name}
                            </label>
                        ))}
                    </div>
                </Field>

                <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
                    Featured
                </label>

                {error && <p className="error">{error}</p>}

                <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                    <button className="secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button onClick={() => save.mutate()} disabled={save.isPending}>
                        {save.isPending ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="field">
            <label>{label}</label>
            {children}
        </div>
    );
}
