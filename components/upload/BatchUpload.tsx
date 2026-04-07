"use client";

import { useState, useCallback, useRef } from "react";

interface FileResult {
  filename: string;
  status: "pending" | "uploading" | "success" | "error";
  documentId?: string;
  type?: string;
  confidence?: number;
  autoFiledTo?: string;
  error?: string;
}

interface BatchUploadProps {
  transactionId?: string;
  onBatchComplete?: (results: FileResult[]) => void;
}

const MAX_CONCURRENT = 5;

export default function BatchUpload({ transactionId, onBatchComplete }: BatchUploadProps) {
  const [files, setFiles] = useState<FileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File): Promise<FileResult> => {
    const result: FileResult = { filename: file.name, status: "uploading" };

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return { ...result, status: "error", error: "Not a PDF" };
    }
    if (file.size > 20 * 1024 * 1024) {
      return { ...result, status: "error", error: "Over 20MB limit" };
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (transactionId) formData.append("transactionId", transactionId);

      const res = await fetch("/api/documents/extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        return { ...result, status: "error", error: data.error || `HTTP ${res.status}` };
      }

      const data = await res.json();
      return {
        ...result,
        status: "success",
        documentId: data.documentId,
        type: data.classification?.type,
        confidence: data.classification?.confidence,
        autoFiledTo: data.autoFile?.applied ? data.autoFile.propertyAddress : undefined,
      };
    } catch (err) {
      return { ...result, status: "error", error: err instanceof Error ? err.message : "Upload failed" };
    }
  };

  const startBatchUpload = useCallback(async (fileList: File[]) => {
    const pdfFiles = fileList.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) return;

    setIsProcessing(true);
    const initialResults: FileResult[] = pdfFiles.map((f) => ({
      filename: f.name,
      status: "pending",
    }));
    setFiles(initialResults);

    const results: FileResult[] = [...initialResults];

    // Process in batches of MAX_CONCURRENT
    for (let i = 0; i < pdfFiles.length; i += MAX_CONCURRENT) {
      const batch = pdfFiles.slice(i, i + MAX_CONCURRENT);
      const batchPromises = batch.map(async (file, batchIdx) => {
        const idx = i + batchIdx;
        // Mark as uploading
        results[idx] = { ...results[idx], status: "uploading" };
        setFiles([...results]);

        const result = await processFile(file);
        results[idx] = result;
        setFiles([...results]);
        return result;
      });

      await Promise.all(batchPromises);
    }

    setIsProcessing(false);
    onBatchComplete?.(results);
  }, [transactionId, onBatchComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) startBatchUpload(dropped);
  }, [startBatchUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) startBatchUpload(selected);
  }, [startBatchUpload]);

  const reset = () => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const progressPercent = files.length > 0
    ? Math.round((files.filter((f) => f.status === "success" || f.status === "error").length / files.length) * 100)
    : 0;

  const typeLabel = (type: string) =>
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="w-full">
      {/* Drop Zone */}
      {files.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-[#6b7d52] bg-[#9aab7e]/10"
              : "border-gray-300 hover:border-[#9aab7e] hover:bg-[#f5f2ea]"
          }`}
        >
          <svg className="mx-auto h-12 w-12 text-[#6b7d52] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-[#1e2416]">Drop multiple PDFs here or click to browse</p>
          <p className="text-xs text-gray-500 mt-1">Up to 20 files at once. Each file max 20MB.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Progress */}
      {files.length > 0 && (
        <div className="space-y-3">
          {/* Summary Bar */}
          <div className="bg-white border border-[#e8e4d8] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#1e2416]">
                {isProcessing ? "Processing..." : "Complete"}
                {" — "}{successCount} success, {errorCount} error{errorCount !== 1 ? "s" : ""}
              </span>
              {!isProcessing && (
                <button onClick={reset} className="text-xs text-[#6b7d52] underline">
                  Upload more
                </button>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-[#6b7d52] h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* File List */}
          <div className="bg-white border border-[#e8e4d8] rounded-lg divide-y divide-[#e8e4d8] max-h-[400px] overflow-y-auto">
            {files.map((file, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center gap-3">
                {/* Status icon */}
                <div className="w-5 flex-shrink-0">
                  {file.status === "pending" && <div className="w-4 h-4 rounded-full bg-gray-200" />}
                  {file.status === "uploading" && (
                    <div className="w-4 h-4 border-2 border-[#6b7d52] border-t-transparent rounded-full animate-spin" />
                  )}
                  {file.status === "success" && (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {file.status === "error" && (
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1e2416] truncate">{file.filename}</p>
                  {file.status === "success" && file.type && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-1.5 py-0.5 bg-[#9aab7e]/15 text-[#6b7d52] rounded text-xs">
                        {typeLabel(file.type)}
                      </span>
                      {file.confidence != null && (
                        <span className="text-xs text-gray-400 font-mono">
                          {(file.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      {file.autoFiledTo && (
                        <span className="text-xs text-green-600">Filed to {file.autoFiledTo}</span>
                      )}
                    </div>
                  )}
                  {file.status === "error" && (
                    <p className="text-xs text-red-500 mt-0.5">{file.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
