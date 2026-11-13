import { MaterialReference, MaterialZone } from '../types/project';

export const flowUrl = 'https://labs.google/fx/tools/flow';
export const fluxUrl = 'https://huggingface.co/spaces/black-forest-labs/FLUX.2-klein-4B';
export const zoneColors = ['#f0b429', '#00d4ff', '#ff69a6', '#74df71', '#b49bff', '#ff744f'];

export interface BridgeAsset {
  name: string;
  image: string;
  mime: string;
}

export function materialName(item: MaterialReference) {
  return [item.brand, item.name, item.article].filter(Boolean).join(' · ');
}

export function materialDescription(item: MaterialReference) {
  return [materialName(item), item.format, item.finish, item.layout, item.notes].filter(Boolean).join(' | ');
}

export async function openBridgePage(url: string) {
  if (window.electronAPI) {
    await window.electronAPI.openExternal(url);
  } else if (!window.open(url, '_blank')) {
    throw new Error('Browser did not open');
  }
}

export function saveBridgeFile(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}

export async function buildSwatchSheet(items: MaterialReference[]): Promise<BridgeAsset | null> {
  const swatches = items.map((item, index) => ({ item, index })).filter(({ item }) => item.imageBase64);
  if (!swatches.length) return null;
  const columns = Math.min(3, swatches.length);
  const canvas = document.createElement('canvas');
  canvas.width = columns * 320;
  canvas.height = Math.ceil(swatches.length / columns) * 260;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const images = await Promise.all(swatches.map(async ({ item }) => {
    const image = new Image();
    image.src = item.imageBase64!.startsWith('data:') ? item.imageBase64! : 'data:' + (item.imageMimeType || 'image/png') + ';base64,' + item.imageBase64;
    await image.decode();
    return image;
  }));
  swatches.forEach(({ item, index: materialIndex }, index) => {
    const x = index % columns * 320 + 12;
    const y = Math.floor(index / columns) * 260 + 12;
    const image = images[index];
    const scale = Math.min(296 / image.naturalWidth, 194 / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, x + (296 - width) / 2, y + (194 - height) / 2, width, height);
    ctx.fillStyle = '#171717';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`M${materialIndex + 1} · ${item.targetSurface}`, x, y + 218, 296);
    ctx.font = '14px sans-serif';
    ctx.fillText(materialName(item), x, y + 238, 296);
  });
  return { name: 'material-swatches', image: canvas.toDataURL('image/png'), mime: 'image/png' };
}

export async function buildZoneGuide(source: string, zones: MaterialZone[], materials: MaterialReference[]): Promise<BridgeAsset> {
  const image = new Image();
  image.src = source;
  await image.decode();
  const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  zones.forEach((zone, index) => {
    const material = materials.findIndex((item) => item.id === zone.materialId);
    if (material < 0) return;
    const color = zoneColors[index % zoneColors.length];
    const x = zone.x * canvas.width;
    const y = zone.y * canvas.height;
    const width = zone.width * canvas.width;
    const height = zone.height * canvas.height;
    ctx.fillStyle = color + '50';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    ctx.font = 'bold 16px sans-serif';
    const label = 'Z' + (index + 1) + ' → M' + (material + 1);
    const badgeWidth = ctx.measureText(label).width + 14;
    const badgeX = Math.max(0, Math.min(x, canvas.width - badgeWidth));
    const badgeY = Math.max(0, Math.min(y, canvas.height - 25));
    ctx.fillStyle = '#111';
    ctx.fillRect(badgeX, badgeY, badgeWidth, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, badgeX + 7, badgeY + 17);
  });
  return { name: '04-zone-guide', image: canvas.toDataURL('image/png'), mime: 'image/png' };
}

export function exportMaterials(items: MaterialReference[]) {
  const row = (cells: string[]) => cells.map((cell) => {
    const safe = /^\s*[=+\-@\t\r\n]/.test(cell) ? "'" + cell : cell;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(',');
  const contents = [
    row(['Surface', 'Brand', 'Material', 'Article', 'Format', 'Finish', 'Layout', 'Notes', 'Catalog']),
    ...items.map((item) => row([item.targetSurface, item.brand || '', item.name, item.article || '', item.format || '', item.finish || '', item.layout || '', item.notes || '', item.url || ''])),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', contents], { type: 'text/csv;charset=utf-8' }));
  saveBridgeFile(url, 'material-schedule.csv');
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
