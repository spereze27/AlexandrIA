import { useRef, useState } from 'react';
import type { FormField } from '../../../types/form';

interface SignatureValue {
  dataUrl: string;
  name: string;
}

interface Props {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  lang: 'es' | 'en';
}

export default function SignatureField({ field, value, onChange, lang }: Props) {
  const sig = value as SignatureValue | undefined;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [techName, setTechName] = useState(sig?.name || '');

  const getCtx = () => canvasRef.current?.getContext('2d');

  const getPos = (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
    if (hasDrawn && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onChange({ dataUrl, name: techName });
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(undefined);
  };

  const handleNameChange = (name: string) => {
    setTechName(name);
    if (sig) {
      onChange({ ...sig, name });
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label[lang]}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Technician name */}
      <input
        type="text"
        value={techName}
        onChange={(e) => handleNameChange(e.target.value)}
        placeholder={lang === 'es' ? 'Nombre del técnico...' : 'Technician name...'}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 mb-3"
      />

      {/* Signature canvas */}
      <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-32 touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-gray-300">
              {lang === 'es' ? 'Firme aquí' : 'Sign here'}
            </p>
          </div>
        )}
      </div>

      {hasDrawn && (
        <button
          onClick={clearSignature}
          className="text-xs text-red-500 hover:text-red-700 mt-2"
        >
          {lang === 'es' ? 'Borrar firma' : 'Clear signature'}
        </button>
      )}
    </div>
  );
}
