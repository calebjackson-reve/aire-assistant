"use client";

import { useState, useCallback, useRef } from "react";

interface ClassificationResult {
  type: string;
  category: string;
  confidence: number;
  lrecFormNumber?: string;
}

interface ExtractionResult {
  fields: Record<string, unknown>;
  confidence: number;
  warnings: string[];
  pageCount: number;
  extractionMethod: string;
}

interface AutoFileResult {
  transactionId: string;
  propertyAddress: string;
  confidence: number;
  matchedOn: string[];
  applied: boolean;
}

interface UploadResult {
  documentId: string;
  filename: string;
  classification: ClassificationResult;
  extraction: ExtractionResult;
  autoFile: AutoFileResult | null;
}

interface DocumentUploadProps {
  transactionId?: string;
  onUploadComplete?: (result: UploadResult) => void;
}

type UploadStatus = "idle" | "uploading" | "processing" | "complete" | "error";

export default function DocumentUpload({ transactionId, onUploadComplete }: DocumentUploadProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported");
      setStatus("error");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File too large. Maximum size is 20MB.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    if (transactionId) formData.append("transactionId", transactionId);

    try {
      setStatus("processing");
      const res = await fetch("/api/documents/extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data: UploadResult = await res.json();
      setResult(data);
      setStatus("complete");
      onUploadComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  }, [transactionId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confidenceColor = (c: number) =>
    c >= 0.8 ? "text-green-700" : c >= 0.5 ? "text-yellow-700" : "text-red-700";

  const typeLabel = (type: string) => type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="w-full">
      {/* Drop Zone */}
      {status === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-[#6b7d52] bg-[#9aab7e]/10"
              : "border-gray-300 hover:border-[#9aab7e] hover:bg-[#f5f2ea]"
          }`}
        >
          <svg className="mx-auto h-10 w-10 text-[#6b7d52] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-[#1e2416]">Drop a PDF here or click to browse</p>
          <p className="text-xs text-gray-500 mt-1">LREC forms, contracts, disclosures — up to 20MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Processing State */}
      {(status === "uploading" || status === "processing") && (
        <div className="border rounded-lg p-6 text-center bg-[#f5f2ea]">
          <div className="animate-spin h-8 w-8 border-2 border-[#6b7d52] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1e2416]">
            {status === "uploading" ? "Uploading..." : "Classifying & extracting fields..."}
          </p>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={reset} className="mt-2 text-xs text-red-600 underline">Try again</button>
        </div>
      )}

      {/* Success State */}
      {status === "complete" && result && (
        <div className="border border-[#9aab7e] rounded-lg p-4 bg-[#f5f2ea] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#1e2416]">{result.filename}</h4>
            <button onClick={reset} className="text-xs text-[#6b7d52] underline">Upload another</button>
          </div>

          {/* Classification */}
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 rounded bg-[#9aab7e]/20 text-[#6b7d52] font-medium text-xs">
              {typeLabel(result.classification.type)}
            </span>
            <span className="text-xs text-gray-500">{result.classification.category}</span>
            <span className={`text-xs font-mono ${confidenceColor(result.classification.confidence)}`}>
              {(result.classification.confidence * 100).toFixed(0)}%
            </span>
            {result.classification.lrecFormNumber && (
              <span className="text-xs text-gray-400">{result.classification.lrecFormNumber}</span>
            )}
          </div>

          {/* Extraction summary */}
          <div className="text-xs text-gray-600">
            {Object.keys(result.extraction.fields).length} fields extracted
            {" · "}{result.extraction.pageCount} pages
            {" · "}{result.extraction.extractionMethod}
            {result.extraction.warnings.length > 0 && (
              <span className="text-yellow-600"> · {result.extraction.warnings.length} warnings</span>
            )}
          </div>

          {/* Auto-file result */}
          {result.autoFile && (
            <div className={`text-xs rounded p-2 ${result.autoFile.applied ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
              {result.autoFile.applied
                ? `Auto-filed to: ${result.autoFile.propertyAddress}`
                : `Suggested match: ${result.autoFile.propertyAddress} (${(result.autoFile.confidence * 100).toFixed(0)}%)`}
            </div>
          )}

          {/* Key fields preview */}
          {Object.keys(result.extraction.fields).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[#6b7d52] font-medium">View extracted fields</summary>
              <div className="mt-2 grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {Object.entries(result.extraction.fields)
                  .filter(([, v]) => v != null && v !== "")
                  .map(([key, val]) => (
                    <div key={key} className="flex gap-1">
                      <span className="text-gray-400">{key}:</span>
                      <span className="text-[#1e2416] truncate">{String(val)}</span>
                    </div>
                  ))}
              </div>
            </details>
          )}

          {/* Warnings */}
          {result.extraction.warnings.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-yellow-600 font-medium">
                {result.extraction.warnings.length} warning(s)
              </summary>
              <ul className="mt-1 space-y-1">
                {result.extraction.warnings.map((w, i) => (
                  <li key={i} className="text-yellow-700">{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
