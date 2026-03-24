import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formsApi } from '../services/api';
import { useAuthStore } from '../store';
import type { FormListItem } from '../types/form';
import { getPendingCount, syncPendingSubmissions } from '../services/offline';

export default function FormListPage() {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    formsApi.list().then((res) => { setForms(res.data); setLoading(false); }).catch(() => setLoading(false));
    getPendingCount().then(setPendingCount);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncPendingSubmissions();
    setSyncing(false);
    setPendingCount(0);
    alert(`Sincronizado: ${result.synced} | Fallidos: ${result.failed}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <h1 className="text-lg font-semibold text-gray-900">FormBuilder</h1>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full font-medium"
            >
              {syncing ? 'Sincronizando...' : `${pendingCount} pendientes`}
            </button>
          )}
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button onClick={logout} className="text-sm text-red-600 hover:text-red-800">
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Mis formularios</h2>
          <button
            onClick={() => navigate('/builder')}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            + Nuevo formulario
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : forms.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No tienes formularios todavía</p>
            <button
              onClick={() => navigate('/builder')}
              className="text-brand-600 font-medium hover:text-brand-800"
            >
              Crear mi primer formulario
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map((form) => (
              <div
                key={form.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-gray-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{form.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {form.submission_count} respuestas · Creado{' '}
                    {new Date(form.created_at).toLocaleDateString('es')}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Link
                    to={`/form/${form.id}`}
                    className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded-lg font-medium hover:bg-green-200"
                  >
                    Llenar
                  </Link>
                  <Link
                    to={`/dashboard/${form.id}`}
                    className="text-xs bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-200"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to={`/builder/${form.id}`}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
