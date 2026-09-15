import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PricingConfig } from '../types';

const FIELDS: { key: keyof PricingConfig; label: string }[] = [
    { key: 'filament_price_per_gram', label: 'Filament price / gram (INR)' },
    { key: 'electricity_rate_per_kwh', label: 'Electricity rate / kWh (INR)' },
    { key: 'printer_power_watts', label: 'Printer power (watts)' },
    { key: 'labor_rate_per_hour', label: 'Labor rate / hour (INR)' },
    { key: 'margin_pct', label: 'Margin (%)' },
];

export default function Pricing() {
    const qc = useQueryClient();
    const config = useQuery({ queryKey: ['admin-pricing'], queryFn: () => api.get<PricingConfig>('/v1/pricing/config') });
    const [form, setForm] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (config.data) {
            setForm({
                filament_price_per_gram: config.data.filament_price_per_gram,
                electricity_rate_per_kwh: config.data.electricity_rate_per_kwh,
                printer_power_watts: config.data.printer_power_watts,
                labor_rate_per_hour: config.data.labor_rate_per_hour,
                margin_pct: config.data.margin_pct,
            });
        }
    }, [config.data]);

    const save = useMutation({
        mutationFn: () => api.patch('/v1/pricing/config', form),
        onSuccess: () => {
            setSaved(true);
            qc.invalidateQueries({ queryKey: ['admin-pricing'] });
        },
        onError: (e: any) => setError(e?.message ?? 'Failed'),
    });

    return (
        <div>
            <div className="page-header">
                <h2>Pricing configuration</h2>
            </div>
            <div className="card" style={{ maxWidth: 480 }}>
                <p className="muted">price = (material + electricity + labor) × (1 + margin)</p>
                {FIELDS.map((f) => (
                    <div className="field" key={f.key}>
                        <label>{f.label}</label>
                        <input
                            value={form[f.key] ?? ''}
                            onChange={(e) => {
                                setSaved(false);
                                setForm((prev) => ({ ...prev, [f.key]: e.target.value }));
                            }}
                        />
                    </div>
                ))}
                {error && <p className="error">{error}</p>}
                <button onClick={() => save.mutate()} disabled={save.isPending}>
                    {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
                </button>
            </div>
        </div>
    );
}
