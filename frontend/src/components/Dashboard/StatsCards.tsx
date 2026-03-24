import type { DashboardStats } from '../../types/form';

interface Props {
  stats: DashboardStats;
}

export default function StatsCards({ stats }: Props) {
  const cards = [
    { label: 'Total registros', value: stats.total_submissions, color: 'bg-blue-50 text-blue-800 border-blue-200' },
    { label: 'Listos', value: stats.ready_for_execution, color: 'bg-green-50 text-green-800 border-green-200' },
    { label: 'Requieren revisión', value: stats.requires_review, color: 'bg-amber-50 text-amber-800 border-amber-200' },
    { label: 'No ejecutable', value: stats.not_executable, color: 'bg-red-50 text-red-800 border-red-200' },
    { label: 'Pendientes', value: stats.pending, color: 'bg-gray-50 text-gray-800 border-gray-200' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border p-4 ${card.color}`}>
          <p className="text-2xl font-bold">{card.value}</p>
          <p className="text-xs mt-1 opacity-80">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
