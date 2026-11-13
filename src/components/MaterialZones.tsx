import { useState } from 'react';
import type { PointerEvent } from 'react';
import { useI18n } from '../i18n/i18nContext';
import { materialName, zoneColors } from '../services/bridgeFiles';
import { MaterialReference, MaterialZone } from '../types/project';

type Point = { x: number; y: number };
const rectangle = (a: Point, b: Point) => ({
  x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y),
});
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function MaterialZones({ source, materials, zones, disabled, onSave }: {
  source: string;
  materials: MaterialReference[];
  zones: MaterialZone[];
  disabled: boolean;
  onSave: (zones: MaterialZone[]) => void;
}) {
  const { t } = useI18n();
  const [materialId, setMaterialId] = useState('');
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const selected = materials.find((item) => item.id === materialId) || materials[0];
  const canDraw = Boolean(selected) && !disabled && zones.length < 12;
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) };
  };
  const overlay = (zone: Pick<MaterialZone, 'x' | 'y' | 'width' | 'height'>, index: number) => ({
    left: zone.x * 100 + '%', top: zone.y * 100 + '%', width: zone.width * 100 + '%', height: zone.height * 100 + '%',
    borderColor: zoneColors[index % zoneColors.length], backgroundColor: zoneColors[index % zoneColors.length] + '45',
  });
  if (!materials.length) return <div><p className="bridge-muted">{t('zones.needMaterials')}</p></div>;
  return <div className="bridge-stack">
    <label className="bridge-field">{t('zones.material')}<select className="studio-control px-3 py-2" value={selected?.id} disabled={disabled}
      onChange={(event) => setMaterialId(event.target.value)}>
      {materials.map((item, index) => <option key={item.id} value={item.id}>M{index + 1} · {materialName(item)}</option>)}
    </select></label>
    <p className="bridge-muted">{t(zones.length >= 12 ? 'zones.limit' : 'zones.hint')}</p>
    <div className={'relative mx-auto w-fit select-none ' + (canDraw ? 'cursor-crosshair touch-none' : '')}
      onPointerDown={(event) => {
        if (!canDraw || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setStart(point(event));
        setEnd(point(event));
      }} onPointerMove={(event) => { if (start) setEnd(point(event)); }} onPointerUp={(event) => {
        if (start && selected && canDraw) {
          const bounds = rectangle(start, point(event));
          if (bounds.width > 0.01 && bounds.height > 0.01) onSave([...zones, { id: crypto.randomUUID(), materialId: selected.id, ...bounds }]);
        }
        setStart(null);
        setEnd(null);
      }} onPointerCancel={() => { setStart(null); setEnd(null); }}>
      <img src={source} alt={t('bridge.sourceImageAlt')} draggable={false} className="block max-h-[480px] max-w-full" />
      {zones.map((zone, index) => <span key={zone.id} className="pointer-events-none absolute border-2" style={overlay(zone, index)}>
        <span className="bg-black px-1 text-xs text-white">Z{index + 1}</span>
      </span>)}
      {start && end && <span className="pointer-events-none absolute border-2" style={overlay(rectangle(start, end), zones.length)} />}
    </div>
    {zones.length > 0 && <ul className="grid gap-2">{zones.map((zone, index) => {
      const item = materials.find((material) => material.id === zone.materialId);
      return <li key={zone.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>Z{index + 1} · {item && materialName(item)}</span>
        <button className="bridge-button" disabled={disabled} onClick={() => onSave(zones.filter((current) => current.id !== zone.id))}>{t('action.delete')}</button>
      </li>;
    })}</ul>}
  </div>;
}
