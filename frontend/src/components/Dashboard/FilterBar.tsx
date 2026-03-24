import type { SeverityFilter, StatusFilter } from './DashboardPage';

interface Props {
  severityFilter: SeverityFilter;
  statusFilter: StatusFilter;
  onSeverityChange: (f: SeverityFilter) => void;
  onStatusChange: (f: StatusFilter) => void;
  totalPoints: number;
  filteredCount: number;
}

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string; dot: string }[] = [
  { value: 'all', label: 'Todos', dot: '' },
  { value: 'green', label: 'Verde', dot: 'bg-severity-green' },
  { value: 'yellow', label: 'Amarillo', dot: 'bg-severity-yellow' },
  { value: 'red', label: 'Rojo', dot: 'bg-severity-red' },
  { value: 'gray', label: 'Gris', dot: 'bg-severity-gray' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'ready', label: 'Listo' },
  { value: 'review', label: 'Revisión' },
  { value: 'not_executable', label: 'No ejecutable' },
  { value: 'pending', label: 'Pendiente' },
];

export default function FilterBar({
  severityFilter, statusFilter, onSeverityChange, onStatusChange, totalPoints, filteredCount,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Severity filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 mr-1">Semáforo:</span>
        {SEVERITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSeverityChange(opt.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              severityFilter === opt.value
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.dot && <span className={`w-2 h-2 rounded-full ${opt.dot}`} />}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 mr-1">Estado:</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Count indicator */}
      <span className="text-xs text-gray-400 ml-auto">
        {filteredCount === totalPoints
          ? `${totalPoints} puntos`
          : `${filteredCount} de ${totalPoints} puntos`}
      </span>
    </div>
  );
}
