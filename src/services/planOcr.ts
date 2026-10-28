export interface PlanMeasurements {
  plotAreaSqm?: number;
  builtUpAreaSqm?: number;
  roadWidthM?: number;
  frontageM?: number;
  frontSetbackM?: number;
  rearSetbackM?: number;
  leftSetbackM?: number;
  rightSetbackM?: number;
}

export interface PlanOcrResult {
  text: string;
  confidence: number;
  pageCount: number;
  extractedAt: string;
  measurements: PlanMeasurements;
}

function findMeasurement(text: string, label: string): number | undefined {
  const match = text.match(new RegExp(`(?:${label})[^\\d\\n]{0,30}(\\d+(?:[.,]\\d+)?)\\s*(sq\\.?\\s*ft|sq\\.?\\s*m|m|metres?|meters?)?`, 'i'));
  if (!match) return undefined;

  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (match[2]?.toLowerCase().includes('ft')) return Number((value * 0.092903).toFixed(2));
  return Number(value.toFixed(2));
}

export function parsePlanMeasurements(text: string): PlanMeasurements {
  return {
    plotAreaSqm: findMeasurement(text, '(?:(?:area\\s*of\\s*)?plot\\s*(?:area|extent)|site\\s*area)'),
    builtUpAreaSqm: findMeasurement(text, '(?:total\\s*)?(?:built[ -]?up|floor)\\s*area'),
    roadWidthM: findMeasurement(text, '(?:abutting\\s*)?road\\s*width'),
    frontageM: findMeasurement(text, '(?:plot\\s*)?frontage'),
    frontSetbackM: findMeasurement(text, '(?:front\\s*(?:setback|yard|margin)|setback\\s*front)'),
    rearSetbackM: findMeasurement(text, '(?:rear\\s*(?:setback|yard|margin)|setback\\s*rear)'),
    leftSetbackM: findMeasurement(text, '(?:left\\s*(?:side\\s*)?(?:setback|yard|margin)|setback\\s*left)'),
    rightSetbackM: findMeasurement(text, '(?:right\\s*(?:side\\s*)?(?:setback|yard|margin)|setback\\s*right)')
  };
}

async function recognizePages(pages: Array<HTMLCanvasElement | File>): Promise<{ text: string; confidence: number }> {
  const Tesseract = await import('tesseract.js');
  const { createWorker } = Tesseract;
  const worker = await createWorker('eng', 1);
  const texts: string[] = [];
  const confidences: number[] = [];

  try {
    await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
    for (const page of pages) {
      const result = await worker.recognize(page);
      if (result.data.text.trim()) texts.push(result.data.text.trim());
      confidences.push(result.data.confidence);
    }
  } finally {
    await worker.terminate();
  }

  return {
    text: texts.join('\n\n').slice(0, 12000),
    confidence: confidences.length ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(1)) : 0
  };
}

async function renderPdfPages(file: File): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const document = await loadingTask.promise;
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 5); pageNumber++) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) continue;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    canvases.push(canvas);
  }

  await loadingTask.destroy();
  return canvases;
}

export async function extractPlanText(file: File, isPdf: boolean): Promise<PlanOcrResult> {
  const pages = isPdf ? await renderPdfPages(file) : [file];
  const recognized = await recognizePages(pages);
  return {
    ...recognized,
    pageCount: pages.length,
    extractedAt: new Date().toISOString(),
    measurements: parsePlanMeasurements(recognized.text)
  };
}