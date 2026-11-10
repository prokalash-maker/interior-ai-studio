import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';

const sourcePath = path.resolve('src/services/ai/ComfyUIProvider.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const js = ts.transpile(source, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const { comfyuiProvider } = mod;
const inputPath = 'C:/Users/user/Downloads/1790337752402688.jpg';
const data = fs.readFileSync(inputPath);
const mime = 'image/jpeg';
const base64 = `data:${mime};base64,${data.toString('base64')}`;

globalThis.Image = class {
  naturalWidth = 2560;
  naturalHeight = 1920;
  set src(_src) { queueMicrotask(() => this.onload?.()); }
};
globalThis.FileReader = class {
  async readAsDataURL(blob) {
    this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
    this.onloadend?.();
  }
};

const result = await comfyuiProvider.generate({
  prompt: 'High-end architectural interior, preserve the exact room and furniture layout.',
  negativePrompt: 'changed layout, moved window or furniture, mixed cabinet finishes, white cabinets, grey clay, warped geometry, plastic surfaces, blurry, malformed furniture',
  sourceImageBase64: base64,
  sourceImageMimeType: mime,
  roomType: 'kitchen',
  styleName: 'warm contemporary luxury',
  selectedMaterialNames: ['American Walnut', 'Roman Travertine Navona', 'Matte Black Steel'],
  manualPromptOverride: false,
  geometryMode: 'strict',
  resolution: '1k',
  customMaterials: 'natural American walnut veneer with vertical tactile grain on all kitchen cabinetry, honed warm beige travertine backsplash, dark graphite stainless steel refrigerator, light limestone floor, soft beige boucle dining chairs',
  customLighting: 'soft warm daylight through the existing window, concealed 3000K LED strip beneath upper cabinets, subtle ceiling track lights, gentle contact shadows, natural exposure',
  customDecor: 'minimal countertop objects, restrained green foliage, keep the existing furniture and camera composition',
  advancedSettings: {
    targetRenderTimeSec: 120,
    denoise: 0.75,
    preserveGeometry: true,
    usePureEmptyLatent: true,
    edgeControlStrength: 0.85,
    depthControlStrength: 0.7,
    seed: 314159,
  },
});
const outPath = 'C:/Users/user/Downloads/Visual AI/test-render-local.png';
fs.writeFileSync(outPath, Buffer.from(result.imageBase64.replace(/^data:image\/[\w+.-]+;base64,/, ''), 'base64'));
console.log(JSON.stringify({ id: result.id, output: outPath, width: result.width, height: result.height, durationSec: result.latencyMs / 1000, promptUsed: result.promptUsed, textNotes: result.textNotes }, null, 2));
