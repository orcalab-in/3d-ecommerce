import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Page, PrintJob, PrintJobStatus } from '../types';

const NEXT: Partial<Record<PrintJobStatus, PrintJobStatus>> = {
    queued: 'printing',
    printing: 'completed',
};

function fmt(min: number) {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
}

export default function PrintQueue() {
    const qc = useQueryClient();
    const jobs = useQuery({ queryKey: ['admin-jobs'], queryFn: () => api.get<Page<PrintJob>>('/v1/print-jobs?limit=200') });
    const queue = useQuery({
        queryKey: ['admin-queue-status'],
        queryFn: () => api.get<{ queued: number; printing: number; est_wait_minutes: number }>('/v1/print-jobs/queue'),
    });

    const advance = useMutation({
        mutationFn: ({ id, status }: { id: string; status: PrintJobStatus }) => api.patch(`/v1/print-jobs/${id}`, { status }),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['admin-jobs'] });
            qc.invalidateQueries({ queryKey: ['admin-queue-status'] });
        },
    });

    return (
        <div>
            <div className="page-header">
                <h2>Print queue</h2>
            </div>

            {queue.data && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <p>
                        <strong>{queue.data.printing}</strong> printing · <strong>{queue.data.queued}</strong> queued ·
                        estimated wait <strong>{fmt(queue.data.est_wait_minutes)}</strong>
                    </p>
                </div>
            )}

            <div className="card">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Printer</th>
                            <th>Est. time</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.data?.items.map((j) => {
                            const next = NEXT[j.status];
                            return (
                                <tr key={j.id}>
                                    <td>{j.queue_position}</td>
                                    <td>{j.printer_name}</td>
                                    <td>{fmt(j.est_minutes)}</td>
                                    <td>
                                        <span className={`badge ${j.status}`}>{j.status}</span>
                                    </td>
                                    <td>
                                        {next && (
                                            <button onClick={() => advance.mutate({ id: j.id, status: next })}>
                                                Mark {next}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {jobs.data && jobs.data.items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="muted">
                                    Queue is empty.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
