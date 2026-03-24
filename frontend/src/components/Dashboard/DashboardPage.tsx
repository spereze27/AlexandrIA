import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dashboardApi, formsApi } from '../../services/api';
import type { DashboardData, Form } from '../../types/form';
import StatsCards from './StatsCards';
import MapView from './MapView';
import FilterBar from './FilterBar';

export type SeverityFilter = 'all' | 'green' | 'yellow' | 'red' | 'gray';
export type StatusFilter = 'all' | 'ready' | 'review' | 'not_executable' | 'pending';

export default function DashboardPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (!formId) return;
    Promise.all([
      formsApi.get(formId),
      dashboardApi.get(formId),
    ])
      .then(([formRes, dashRes]) => {
        setForm(formRes.data);
        setData(dashRes.data);
      })
      .finally(() => setLoading(false));
  }, [formId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Cargando dashboard...
      </div>
    );
  }

  if (!data || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        No se encontró el formulario
      </div>
    );
  }

  const filteredPoints = data.map_points.filter((point) => {
    if (severityFilter !== 'all' && point.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && point.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
              ← Volver
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{form.name}</h1>
              <p className="text-xs text-gray-500">Dashboard · {data.stats.total_submissions} registros</p>
            </div>
          </div>
          {form.sheets_url && (
            <a
              href={form.sheets_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded-lg font-medium hover:bg-green-200"
            >
              Abrir Google Sheet
            </a>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats cards */}
        <StatsCards stats={data.stats} />

        {/* Filters */}
        <FilterBar
          severityFilter={severityFilter}
          statusFilter={statusFilter}
          onSeverityChange={setSeverityFilter}
          onStatusChange={setStatusFilter}
          totalPoints={data.map_points.length}
          filteredCount={filteredPoints.length}
        />

        {/* Map */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: '500px' }}>
          <MapView points={filteredPoints} />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-severity-green" />
            Listo para ejecutar
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-severity-yellow" />
            Requiere revisión
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-severity-red" />
            No ejecutable / Crítico
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-severity-gray" />
            Sin datos
          </div>
        </div>
      </main>
    </div>
  );
}
