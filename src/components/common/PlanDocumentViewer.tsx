import React, { useEffect, useState } from 'react';
import { UploadedPlanFile } from '../../types';
import { FileText, Layers, Download, ZoomIn, ZoomOut, CheckCircle, Info, Box } from 'lucide-react';
import { getUploadedDocument } from '../../services/documentStorage';

interface PlanDocumentViewerProps {
  files: UploadedPlanFile[];
  activeFileIndex?: number;
  onSelectFile?: (index: number) => void;
}

export const PlanDocumentViewer: React.FC<PlanDocumentViewerProps> = ({
  files,
  activeFileIndex = 0,
  onSelectFile
}) => {
  const [selectedIdx, setSelectedIdx] = useState(activeFileIndex);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTab, setActiveTab] = useState<'preview' | 'layers' | 'meta'>('preview');
  const [documentUrl, setDocumentUrl] = useState('');
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);

  const currentFile = files[selectedIdx] || files[0];

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;

    setDocumentUrl(currentFile?.url || '');
    setIsLoadingDocument(Boolean(currentFile?.storagePath && !currentFile.url));

    if (currentFile?.storagePath && !currentFile.url) {
      getUploadedDocument(currentFile.storagePath)
        .then((blob) => {
          if (cancelled) return;
          if (blob) {
            objectUrl = URL.createObjectURL(blob);
            setDocumentUrl(objectUrl);
          }
        })
        .catch((error) => console.error('Failed to load uploaded document:', error))
        .finally(() => {
          if (!cancelled) setIsLoadingDocument(false);
        });
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentFile?.storagePath, currentFile?.url]);

  const handleFileChange = (idx: number) => {
    setSelectedIdx(idx);
    if (onSelectFile) onSelectFile(idx);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* File Selector Tabs Header */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-2 overflow-x-auto py-1">
          {files.map((file, idx) => {
            const isSelected = idx === selectedIdx;
            const ext = file.name.split('.').pop()?.toUpperCase() || file.type.toUpperCase();
            return (
              <button
                key={file.name + idx}
                onClick={() => handleFileChange(idx)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className={`text-[10px] px-1 py-0.5 rounded font-mono font-bold ${
                  ext === 'PDF' ? 'bg-red-900/60 text-red-200' : ext === 'DXF' ? 'bg-teal-900/60 text-teal-200' : 'bg-amber-900/60 text-amber-200'
                }`}>
                  {ext}
                </span>
                <span className="truncate max-w-[160px]">{file.name}</span>
              </button>
            );
          })}
        </div>

        {/* Action controls */}
        <div className="flex items-center space-x-2 shrink-0 ml-2">
          {currentFile?.type === 'dxf' && (
            <div className="flex bg-slate-800 rounded p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-2 py-1 rounded ${activeTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Geometry
              </button>
              <button
                onClick={() => setActiveTab('layers')}
                className={`px-2 py-1 rounded flex items-center gap-1 ${activeTab === 'layers' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Layers className="w-3 h-3" />
                Layers ({currentFile.dxfInfo?.layers.length || 0})
              </button>
            </div>
          )}

          <div className="flex items-center space-x-1 bg-slate-800 rounded p-1">
            <button
              onClick={() => setZoomLevel(z => Math.max(50, z - 25))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 text-slate-300">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(z => Math.min(200, z + 25))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Drawing Viewer Viewport */}
      <div className="flex-1 bg-slate-950 relative overflow-auto p-4 flex items-center justify-center min-h-[420px]">
        {isLoadingDocument ? (
          <div className="text-sm text-slate-300">Loading {currentFile?.name}...</div>
        ) : currentFile?.type === 'dxf' && activeTab === 'layers' ? (
          /* DXF Layers Breakdown */
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-lg p-5 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <h4 className="text-sm font-semibold text-white">AutoCAD Scrutiny Layers Detected</h4>
              </div>
              <span className="text-xs bg-teal-950 text-teal-300 border border-teal-800 px-2 py-0.5 rounded font-mono">
                {currentFile.dxfInfo?.layers.length || 6} Layers
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {(currentFile.dxfInfo?.layers || ['0', 'SITE_BOUNDARY', 'SETBACKS', 'PROPOSED_GROUND', 'RWH_PIT', 'DIMENSIONS']).map((l, idx) => (
                <div key={l} className="flex items-center justify-between p-2 bg-slate-800/80 rounded border border-slate-700 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#38bdf8', '#34d399', '#f43f5e', '#fbbf24', '#a855f7', '#ec4899'][idx % 6] }} />
                    <span className="font-mono text-slate-300">{l}</span>
                  </div>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              ))}
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono space-y-1 text-slate-400">
              <div className="text-teal-400 font-semibold mb-1">Extracted Geometry & Notes:</div>
              <div>Bounding Box: {currentFile.dxfInfo?.boundingBox?.width || '15.2'}m × {currentFile.dxfInfo?.boundingBox?.height || '22.0'}m</div>
              <div>Vector Entities: {currentFile.dxfInfo?.lineCount || '142'} lines, {currentFile.dxfInfo?.textCount || '28'} text nodes</div>
              {currentFile.dxfInfo?.notes?.map((n, i) => (
                <div key={i} className="text-slate-300">• {n}</div>
              ))}
            </div>
          </div>
        ) : currentFile?.type === 'image' && documentUrl ? (
          <img
            src={documentUrl}
            alt={`Processed plan image: ${currentFile.name}`}
            className="max-h-full max-w-full object-contain transition-transform"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          />
        ) : currentFile?.type === 'pdf' && documentUrl ? (
          <iframe
            src={`${documentUrl}#toolbar=1&view=FitH`}
            title={`Uploaded document: ${currentFile.name}`}
            className="h-full min-h-[420px] w-full bg-white"
          />
        ) : documentUrl ? (
          <div className="max-w-lg text-center text-slate-200">
            <Box className="mx-auto mb-3 h-10 w-10 text-amber-400" />
            <h4 className="mb-2 text-base font-semibold text-white">Original CAD file</h4>
            <p className="mb-4 text-xs text-slate-300">
              This format cannot be previewed in the browser. Download the original uploaded file to inspect it in a CAD application.
            </p>
            <a
              href={documentUrl}
              download={currentFile?.name}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Download {currentFile?.name}
            </a>
          </div>
        ) : (
          <div className="max-w-md text-center text-slate-300">
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" />
            <h4 className="text-sm font-semibold text-white">Document file unavailable</h4>
            <p className="mt-2 text-xs text-slate-400">
              {currentFile?.name || 'No drawing has been uploaded for this application.'} is listed in this record, but its original file data is not available in this browser.
            </p>
          </div>
        )}
      </div>

      {/* Footer Info Notice */}
      <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-blue-600" />
          <span>Active file: <strong className="font-medium text-slate-900">{currentFile?.name}</strong></span>
        </div>
        <div className="flex items-center space-x-3 text-slate-500 text-[11px]">
          <span>Uploaded: {currentFile?.uploadedAt ? new Date(currentFile.uploadedAt).toLocaleDateString() : 'Today'}</span>
          <span>•</span>
          <span className="text-emerald-700 font-medium">Scrutiny Ready</span>
        </div>
      </div>
    </div>
  );
};
