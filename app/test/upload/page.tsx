"use client";

import { useState, useCallback } from "react";

interface ExtractionResponse {
  documentId: string;
  filename: string;
  classification: {
    type: string;
    category: string;
    confidence: number;
    lrecFormNumber?: string;
  };
  extraction: {
    fields: Record<string, string | number | boolean | null>;
    confidence: number;
    warnings: string[];
    pageCount: number;
  };
}

export default function TestUploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ExtractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setSelectedFile(file);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data: ExtractionResponse = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "0 24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#e4e4e7",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        AIRE Document Extraction — Test
      </h1>
      <p style={{ color: "#a1a1aa", marginBottom: 32 }}>
        Drop a Louisiana real estate PDF to test classification + field extraction.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? "#3b82f6" : "#3f3f46"}`,
          borderRadius: 12,
          padding: 48,
          textAlign: "center",
          background: isDragging ? "rgba(59,130,246,0.05)" : "#18181b",
          transition: "all 0.2s",
          cursor: "pointer",
        }}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
        <p style={{ fontSize: 16, color: "#a1a1aa" }}>
          {isProcessing
            ? "Processing..."
            : "Drag & drop a PDF here, or click to select"}
        </p>
        {selectedFile && (
          <p style={{ fontSize: 14, color: "#71717a", marginTop: 8 }}>
            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#1e1e22",
            borderRadius: 8,
            textAlign: "center",
            color: "#3b82f6",
          }}
        >
          ⏳ Extracting fields with AI... This may take 10-20 seconds.
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "#2d1215",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            color: "#fca5a5",
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 32 }}>
          {/* Classification */}
          <div
            style={{
              padding: 20,
              background: "#1e1e22",
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
              Classification
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <span style={{ color: "#71717a", fontSize: 13 }}>Type</span>
                <p style={{ fontWeight: 600 }}>{result.classification.type}</p>
              </div>
              <div>
                <span style={{ color: "#71717a", fontSize: 13 }}>Category</span>
                <p style={{ fontWeight: 600 }}>{result.classification.category}</p>
              </div>
              <div>
                <span style={{ color: "#71717a", fontSize: 13 }}>Confidence</span>
                <p style={{ fontWeight: 600 }}>
                  {(result.classification.confidence * 100).toFixed(0)}%
                </p>
              </div>
              {result.classification.lrecFormNumber && (
                <div>
                  <span style={{ color: "#71717a", fontSize: 13 }}>
                    LREC Form #
                  </span>
                  <p style={{ fontWeight: 600 }}>
                    {result.classification.lrecFormNumber}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Warnings */}
          {result.extraction.warnings.length > 0 && (
            <div
              style={{
                padding: 16,
                background: "#2d2305",
                border: "1px solid #854d0e",
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>
                Warnings
              </h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#fde68a" }}>
                {result.extraction.warnings.map((w, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Extracted Fields */}
          <div
            style={{
              padding: 20,
              background: "#1e1e22",
              borderRadius: 8,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
              Extracted Fields
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: "#71717a",
                  marginLeft: 12,
                }}
              >
                Confidence: {(result.extraction.confidence * 100).toFixed(0)}%
              </span>
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 24px",
              }}
            >
              {Object.entries(result.extraction.fields).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid #27272a",
                  }}
                >
                  <span style={{ color: "#71717a", fontSize: 12 }}>{key}</span>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      wordBreak: "break-word",
                      color: value === null ? "#52525b" : "#e4e4e7",
                    }}
                  >
                    {value === null ? "—" : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Raw JSON */}
          <details style={{ marginTop: 16 }}>
            <summary
              style={{ cursor: "pointer", color: "#71717a", fontSize: 13 }}
            >
              Raw JSON Response
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 16,
                background: "#0f0f11",
                borderRadius: 8,
                fontSize: 12,
                overflow: "auto",
                maxHeight: 400,
                color: "#a1a1aa",
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
