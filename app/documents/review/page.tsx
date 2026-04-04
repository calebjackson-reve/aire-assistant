"use client";

import { useState, useEffect, useCallback } from "react";

interface ReviewItem {
  id: string;
  fileName: string;
  classifiedType: string;
  classifiedConf: number;
  extractionMethod: string | null;
  fileSize: number;
  pageCount: number | null;
  createdAt: string;
  transaction: { propertyAddress: string } | null;
}

const DOCUMENT_TYPES = [
  "purchase_agreement",
  "property_disclosure",
  "agency_disclosure",
  "dual_agency_consent",
  "lead_paint",
  "inspection_response",
  "condominium_addendum",
  "deposit_addendum",
  "new_construction_addendum",
  "historic_district_addendum",
  "private_sewerage_addendum",
  "buyer_option_flowchart",
  "home_warranty",
  "property_management",
  "vacant_land",
  "waiver_warranty",
  "amendment",
  "addendum",
  "contract",
  "other",
];

function confidenceColor(conf: number): string {
  if (conf >= 0.7) return "#22c55e";
  if (conf >= 0.5) return "#f59e0b";
  return "#ef4444";
}

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [correcting, setCorrecting] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/documents/memory/review-queue");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch review queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleConfirm = async (id: string) => {
    const res = await fetch(`/api/documents/memory/${id}/correct`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((prev) => prev - 1);
    }
  };

  const handleCorrect = async (id: string, newType: string) => {
    const res = await fetch(`/api/documents/memory/${id}/correct`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correctedType: newType }),
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((prev) => prev - 1);
      setCorrecting(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#a1a1aa" }}>
        Loading review queue...
      </div>
    );
  }

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
            Document Review Queue
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: 14 }}>
            Review uncertain classifications to help the system learn.
          </p>
        </div>
        <div
          style={{
            background: total > 0 ? "#7f1d1d" : "#14532d",
            color: total > 0 ? "#fca5a5" : "#86efac",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {total} pending
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: "#18181b",
            borderRadius: 12,
            color: "#71717a",
          }}
        >
          No documents need review. The system is classifying everything confidently.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 20,
                background: "#1e1e22",
                borderRadius: 10,
                border: "1px solid #27272a",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>
                  {item.fileName}
                </div>
                <div
                  style={{
                    color: confidenceColor(item.classifiedConf),
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {(item.classifiedConf * 100).toFixed(0)}%
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#a1a1aa",
                }}
              >
                <div>
                  <span style={{ color: "#71717a" }}>Classified as</span>
                  <p style={{ fontWeight: 600, color: "#e4e4e7" }}>
                    {item.classifiedType}
                  </p>
                </div>
                <div>
                  <span style={{ color: "#71717a" }}>Method</span>
                  <p style={{ fontWeight: 500 }}>{item.extractionMethod || "—"}</p>
                </div>
                <div>
                  <span style={{ color: "#71717a" }}>Uploaded</span>
                  <p style={{ fontWeight: 500 }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {item.transaction && (
                <div style={{ fontSize: 13, color: "#71717a", marginBottom: 12 }}>
                  Transaction: {item.transaction.propertyAddress}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => handleConfirm(item.id)}
                  style={{
                    background: "#14532d",
                    color: "#86efac",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Confirm
                </button>

                {correcting === item.id ? (
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleCorrect(item.id, e.target.value);
                    }}
                    style={{
                      background: "#27272a",
                      color: "#e4e4e7",
                      border: "1px solid #3f3f46",
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select correct type...
                    </option>
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setCorrecting(item.id)}
                    style={{
                      background: "#422006",
                      color: "#fbbf24",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Correct
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
