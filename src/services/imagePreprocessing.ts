import type { CV } from '@techstark/opencv-js';

type OpenCvRuntime = CV & { onRuntimeInitialized?: () => void };

let openCvRuntimePromise: Promise<OpenCvRuntime> | undefined;

async function loadOpenCv(): Promise<OpenCvRuntime> {
  if (!openCvRuntimePromise) {
    openCvRuntimePromise = (async () => {
      const imported = await import('@techstark/opencv-js') as unknown as {
        default?: OpenCvRuntime | Promise<OpenCvRuntime>;
      } & OpenCvRuntime;
      const exported = imported.default ?? imported;
      const runtime = exported instanceof Promise ? await exported : exported;

      if (!runtime.Mat) {
        await new Promise<void>((resolve) => {
          runtime.onRuntimeInitialized = resolve;
        });
      }

      return runtime;
    })();
  }

  return openCvRuntimePromise;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const imageUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('The selected image could not be opened.'));
    };
    image.src = imageUrl;
  });
}

export async function preprocessPlanImage(file: File): Promise<File> {
  const [cv, image] = await Promise.all([loadOpenCv(), loadImage(file)]);
  const source = cv.imread(image);
  const grayscale = new cv.Mat();
  const enhanced = new cv.Mat();
  const clahe = cv.createCLAHE(2, new cv.Size(8, 8));
  const canvas = document.createElement('canvas');

  try {
    cv.cvtColor(source, grayscale, cv.COLOR_RGBA2GRAY);
    clahe.apply(grayscale, enhanced);
    cv.imshow(canvas, enhanced);

    const processedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('The processed image could not be encoded.')),
        file.type,
        0.95
      );
    });

    return new File([processedBlob], file.name, {
      type: processedBlob.type || file.type,
      lastModified: file.lastModified
    });
  } finally {
    source.delete();
    grayscale.delete();
    enhanced.delete();
    clahe.delete();
  }
}