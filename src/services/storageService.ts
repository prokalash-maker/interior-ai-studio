export class StorageService {
  /**
   * Generates a clean Archicad-style clay render placeholder on canvas
   * (White/grey monochrome interior with walls, window openings, perspective lines, sofa, and kitchen bar)
   */
  static generateSampleClayRender(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Studio Clay Palette
    const bg = '#dce1e6';
    const wallLeft = '#c5ccd4';
    const wallRight = '#d0d7df';
    const floor = '#b4bcc5';
    const ceiling = '#e6ecf2';
    const furnitureLight = '#f8fafc';
    const furnitureShadow = '#9ba5b1';
    const windowSky = '#edf2f7';

    // Background & Ceiling
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = ceiling;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.lineTo(1350, 240);
    ctx.lineTo(480, 240);
    ctx.closePath();
    ctx.fill();

    // Floor
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.moveTo(0, 1080);
    ctx.lineTo(canvas.width, 1080);
    ctx.lineTo(1350, 780);
    ctx.lineTo(480, 780);
    ctx.closePath();
    ctx.fill();

    // Back Wall
    ctx.fillStyle = '#cfd7df';
    ctx.fillRect(480, 240, 870, 540);

    // Left Wall with large Archicad panoramic window
    ctx.fillStyle = wallLeft;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(480, 240);
    ctx.lineTo(480, 780);
    ctx.lineTo(0, 1080);
    ctx.closePath();
    ctx.fill();

    // Panoramic Window Aperture on Left Wall
    ctx.fillStyle = windowSky;
    ctx.beginPath();
    ctx.moveTo(80, 220);
    ctx.lineTo(400, 310);
    ctx.lineTo(400, 720);
    ctx.lineTo(80, 880);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Right Wall
    ctx.fillStyle = wallRight;
    ctx.beginPath();
    ctx.moveTo(1350, 240);
    ctx.lineTo(canvas.width, 0);
    ctx.lineTo(canvas.width, 1080);
    ctx.lineTo(1350, 780);
    ctx.closePath();
    ctx.fill();

    // Archicad Model Geometry: Designer Sofa in Center
    ctx.fillStyle = furnitureLight;
    // Sofa Base
    ctx.fillRect(660, 640, 520, 110);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(660, 640, 520, 110);

    // Sofa Backrest
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(680, 550, 480, 100);
    ctx.strokeRect(680, 550, 480, 100);

    // Coffee Table (Clay Box)
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(780, 760, 280, 70);
    ctx.strokeRect(780, 760, 280, 70);

    // Kitchen Island / Cabinet block on right
    ctx.fillStyle = furnitureShadow;
    ctx.beginPath();
    ctx.moveTo(1250, 600);
    ctx.lineTo(1550, 540);
    ctx.lineTo(1550, 820);
    ctx.lineTo(1250, 850);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pendant architectural lights (clay cylinders)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    // Wire 1
    ctx.beginPath();
    ctx.moveTo(820, 240);
    ctx.lineTo(820, 420);
    ctx.stroke();
    ctx.fillRect(805, 420, 30, 45);

    // Wire 2
    ctx.beginPath();
    ctx.moveTo(1020, 240);
    ctx.lineTo(1020, 400);
    ctx.stroke();
    ctx.fillRect(1005, 400, 30, 45);

    // Studio Technical Stamp
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText('ARCHICAD CLAY RENDER // FOV: 78° // CAMERA PERSPECTIVE #01', 50, 60);
    ctx.font = '16px "Inter", sans-serif';
    ctx.fillText('Source Model: Living Room Open Space | Untextured Geometry Reference', 50, 90);

    return canvas.toDataURL('image/png');
  }

  /**
   * Generates a fully textured, photorealistic version of the Archicad clay render
   * (Warm oak chevron floor, calacatta marble table, warm bouclé sofa, golden sunlight, and art lighting)
   */
  static generateRealisticSampleRender(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Ceiling with architectural cove light
    const ceilingGrad = ctx.createLinearGradient(0, 0, 0, 240);
    ceilingGrad.addColorStop(0, '#f8fafc');
    ceilingGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = ceilingGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.lineTo(1350, 240);
    ctx.lineTo(480, 240);
    ctx.closePath();
    ctx.fill();

    // Warm European White Oak Parquet Floor
    const floorGrad = ctx.createLinearGradient(0, 780, 0, 1080);
    floorGrad.addColorStop(0, '#c4a482');
    floorGrad.addColorStop(0.5, '#b5926e');
    floorGrad.addColorStop(1, '#9e7b57');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.moveTo(0, 1080);
    ctx.lineTo(canvas.width, 1080);
    ctx.lineTo(1350, 780);
    ctx.lineTo(480, 780);
    ctx.closePath();
    ctx.fill();

    // Floor planks subtle grain lines
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.15)';
    ctx.lineWidth = 1.5;
    for (let x = 100; x < 1800; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 1080);
      ctx.lineTo(480 + (x * 0.45), 780);
      ctx.stroke();
    }

    // Back Wall: Architectural Mineral Plaster with subtle warmth
    const wallGrad = ctx.createLinearGradient(480, 240, 1350, 780);
    wallGrad.addColorStop(0, '#f1ede4');
    wallGrad.addColorStop(1, '#e5ded2');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(480, 240, 870, 540);

    // Left Wall with warm daylight gradient
    const leftWallGrad = ctx.createLinearGradient(0, 0, 480, 780);
    leftWallGrad.addColorStop(0, '#fefefe');
    leftWallGrad.addColorStop(1, '#e0d8cc');
    ctx.fillStyle = leftWallGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(480, 240);
    ctx.lineTo(480, 780);
    ctx.lineTo(0, 1080);
    ctx.closePath();
    ctx.fill();

    // Panoramic Window: Realistic Landscape with soft morning blur
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.moveTo(80, 220);
    ctx.lineTo(400, 310);
    ctx.lineTo(400, 720);
    ctx.lineTo(80, 880);
    ctx.closePath();
    ctx.fill();

    // Soft morning trees & city view through window
    const skyGrad = ctx.createLinearGradient(80, 220, 400, 720);
    skyGrad.addColorStop(0, '#e0f2fe');
    skyGrad.addColorStop(0.6, '#bfdbfe');
    skyGrad.addColorStop(1, '#86efac');
    ctx.fillStyle = skyGrad;
    ctx.fill();

    // Thin black aluminum window frame
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Right Wall: Fluted Oak Wood Tambour Panels
    const rightGrad = ctx.createLinearGradient(1350, 240, 1920, 1080);
    rightGrad.addColorStop(0, '#8c6d4f');
    rightGrad.addColorStop(1, '#5c432d');
    ctx.fillStyle = rightGrad;
    ctx.beginPath();
    ctx.moveTo(1350, 240);
    ctx.lineTo(canvas.width, 0);
    ctx.lineTo(canvas.width, 1080);
    ctx.lineTo(1350, 780);
    ctx.closePath();
    ctx.fill();

    // Natural Sunlight beam cast from window across floor & wall
    const sunGrad = ctx.createRadialGradient(300, 400, 50, 800, 850, 600);
    sunGrad.addColorStop(0, 'rgba(255, 248, 220, 0.45)');
    sunGrad.addColorStop(0.7, 'rgba(255, 235, 180, 0.15)');
    sunGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.moveTo(80, 220);
    ctx.lineTo(1400, 760);
    ctx.lineTo(1100, 1050);
    ctx.lineTo(80, 880);
    ctx.closePath();
    ctx.fill();

    // Sofa Shadow
    ctx.fillStyle = 'rgba(30, 20, 10, 0.35)';
    ctx.beginPath();
    ctx.ellipse(920, 765, 280, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sofa: Tactile Warm Cream Bouclé Fabric
    ctx.fillStyle = '#faf7f2';
    ctx.fillRect(660, 640, 520, 110);
    ctx.fillStyle = '#f3ede4';
    ctx.fillRect(680, 550, 480, 100);

    // Sofa soft cushions & seams
    ctx.strokeStyle = '#d6ccc2';
    ctx.lineWidth = 2;
    ctx.strokeRect(660, 640, 520, 110);
    ctx.strokeRect(680, 550, 480, 100);

    // Warm decorative cashmere throw blanket on sofa
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath();
    ctx.moveTo(1050, 630);
    ctx.lineTo(1150, 650);
    ctx.lineTo(1130, 740);
    ctx.lineTo(1040, 730);
    ctx.closePath();
    ctx.fill();

    // Coffee Table: Honed Calacatta Gold Marble Slab
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(780, 760, 280, 70);
    // Gold/Grey marble veins
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(790, 770);
    ctx.bezierCurveTo(860, 780, 920, 765, 1040, 785);
    ctx.stroke();

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(820, 800);
    ctx.bezierCurveTo(900, 790, 950, 820, 1020, 810);
    ctx.stroke();

    // Brass Pedestal Lighting (Brushed Champagne Brass)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(820, 240);
    ctx.lineTo(820, 420);
    ctx.moveTo(1020, 240);
    ctx.lineTo(1020, 400);
    ctx.stroke();

    // Glowing brass cylindrical fixtures
    const brassGrad = ctx.createLinearGradient(805, 420, 835, 465);
    brassGrad.addColorStop(0, '#fef08a');
    brassGrad.addColorStop(0.5, '#eab308');
    brassGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = brassGrad;
    ctx.fillRect(805, 420, 30, 45);
    ctx.fillRect(1005, 400, 30, 45);

    // Soft warm ambient glow under lights (2700K)
    const glow1 = ctx.createRadialGradient(820, 465, 5, 820, 465, 90);
    glow1.addColorStop(0, 'rgba(254, 240, 138, 0.6)');
    glow1.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = glow1;
    ctx.beginPath();
    ctx.arc(820, 465, 90, 0, Math.PI * 2);
    ctx.fill();

    // Studio Quality Stamp
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText('NANO BANANA PRO // PHOTOREALISTIC INTERIOR SYNTHESIS // 4K PBR', 50, 60);

    return canvas.toDataURL('image/png');
  }

  static async exportImage(
    base64Data: string,
    defaultName: string,
    format: 'png' | 'jpeg',
    quality: number = 0.95
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

    if (window.electronAPI) {
      try {
        const dialogRes = await window.electronAPI.saveImageDialog(defaultName, format);
        if (dialogRes.canceled || !dialogRes.filePath) {
          return { success: false };
        }
        const saved = await window.electronAPI.writeImageFile(dialogRes.filePath, cleanBase64);
        if (saved) {
          return { success: true, filePath: dialogRes.filePath };
        }
        return { success: false, error: 'Ошибка записи файла на диск' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Browser download fallback
    try {
      const link = document.createElement('a');
      link.download = `${defaultName}.${format === 'png' ? 'png' : 'jpg'}`;
      link.href = `data:image/${format};base64,${cleanBase64}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async copyToClipboard(base64Data: string): Promise<boolean> {
    if (window.electronAPI) {
      return window.electronAPI.copyImageToClipboard(base64Data);
    }
    // Web Clipboard API fallback
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      return true;
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
      return false;
    }
  }

  static async openFolder(filePath: string): Promise<void> {
    if (window.electronAPI && filePath) {
      await window.electronAPI.openFolderInExplorer(filePath);
    }
  }
}
