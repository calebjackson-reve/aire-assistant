"use client";

import { useState, useCallback } from "react";

interface ExtractedField {
  key: string;
  value: string | number | boolean | null;
  corrected?: string;
}

interface DocumentViewerProps {
  documentId: string;
  filename: string;
  fileUrl?: string;
  documentType: string;
  extractedFields: Record<string, string | number | boolean | null>;
  confidence: number;
  onFieldCorrected?: (key: string, correctedValue: string) => void;
}

export default function DocumentViewer({
  documentId,
  filename,
  fileUrl,
  documentType,
  extractedFields,
  confidence,
  onFieldCorrected,
}: DocumentViewerProps) {
  const [fields, setFields] = useState<ExtractedField[]>(
    Object.entries(extractedFields).map(([key, value]) => ({ key, value }))
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const startEdit = useCallback((field: ExtractedField) => {
    setEditingField(field.key);
    setEditValue(String(field.corrected ?? field.value ?? ""));
  }, []);

  const saveCorrection = useCallback(async (key: string) => {
    setSaving(true);
    try {
      // Save to document memory for learning
      await fetch(`/api/documents/${documentId}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: key, correctedValue: editValue }),
      });

      setFields((prev) =>
        prev.map((f) => (f.key === key ? { ...f, corrected: editValue } : f))
      );
      setEditingField(null);
      onFieldCorrected?.(key, editValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save correction:", err);
    } finally {
      setSaving(false);
    }
  }, [documentId, editValue, onFieldCorrected]);

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const typeLabel = (type: string) =>
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const confidenceColor =
    confidence >= 0.8 ? "text-green-700 bg-green-50" : confidence >= 0.5 ? "text-yellow-700 bg-yellow-50" : "text-red-700 bg-red-50";

  return (
    <div className="bg-white rounded-lg border border-[#e8e4d8] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#e8e4d8] bg-[#f5f2ea]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#1e2416] text-sm">{filename}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded bg-[#9aab7e]/15 text-[#6b7d52] text-xs font-medium">
                {typeLabel(documentType)}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-mono ${confidenceColor}`}>
                {(confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
          </div>
          {saved && (
            <span className="text-xs text-green-600 font-medium">Correction saved</span>
          )}
        </div>
      </div>

      <div className="flex">
        {/* PDF Preview */}
        <div className="flex-1 min-h-[400px] bg-gray-100 flex items-center justify-center border-r border-[#e8e4d8]">
          {fileUrl ? (
            <iframe
              src={fileUrl}
              className="w-full h-[600px]"
              title={`PDF: ${filename}`}
            />
          ) : (
            <div className="text-center text-gray-400 p-8">
              <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">PDF preview not available</p>
              <p className="text-xs mt-1">Upload to Vercel Blob to enable preview</p>
            </div>
          )}
        </div>

        {/* Extracted Fields Panel */}
        <div className="w-80 max-h-[600px] overflow-y-auto">
          <div className="p-3 border-b border-[#e8e4d8] bg-[#f5f2ea]">
            <h4 className="text-xs font-semibold text-[#6b7d52] uppercase tracking-wider">
              Extracted Fields ({fields.filter((f) => f.value != null).length})
            </h4>
            <p className="text-xs text-gray-400 mt-0.5">Click any field to correct it</p>
          </div>
          <div className="divide-y divide-[#e8e4d8]">
            {fields.map((field) => (
              <div
                key={field.key}
                className="p-3 hover:bg-[#f5f2ea]/50 transition-colors cursor-pointer"
                onClick={() => editingField !== field.key && startEdit(field)}
              >
                <div className="text-xs text-gray-400 mb-0.5">{field.key}</div>
                {editingField === field.key ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveCorrection(field.key);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="flex-1 text-sm border border-[#9aab7e] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#9aab7e]"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); saveCorrection(field.key); }}
                      disabled={saving}
                      className="px-2 py-1 bg-[#6b7d52] text-white rounded text-xs disabled:opacity-50"
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                      className="px-2 py-1 bg-gray-200 rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className={`text-sm ${field.corrected ? "text-green-700 font-medium" : "text-[#1e2416]"}`}>
                      {String(field.corrected ?? field.value ?? "—")}
                    </span>
                    {field.corrected && (
                      <span className="text-xs text-green-500">corrected</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
