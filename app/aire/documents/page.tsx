"use client";

import { useState, useEffect, useCallback } from "react";
import { FeedbackButtons } from "@/components/FeedbackButtons";

interface TransactionOption {
  id: string;
  propertyAddress: string;
  status: string;
}

interface DocumentRecord {
  id: string;
  name: string;
  type: string;
  category: string | null;
  checklistStatus: string | null;
  fileSize: number | null;
  pageCount: number | null;
  fileUrl: string | null;
  createdAt: string;
  transaction: TransactionOption | null;
  classification: {
    confidence?: number;
    lrecFormNumber?: string;
  } | null;
}

const DOC_TYPES = [
  "purchase_agreement",
  "property_disclosure",
  "agency_disclosure",
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
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [txFilter, setTxFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (txFilter) params.set("transactionId", txFilter);

      const res = await fetch(`/api/documents/list?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
        if (data.transactions) setTransactions(data.transactions);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, typeFilter, txFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  };

  const bulkMarkVerified = async () => {
    if (selectedIds.size === 0) return;
    try {
      await fetch("/api/documents/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds], action: "verify" }),
      });
      setSelectedIds(new Set());
      fetchDocuments();
    } catch (err) {
      console.error("Bulk verify failed:", err);
    }
  };

  const bulkDownload = () => {
    const docsWithUrls = documents.filter(
      (d) => selectedIds.has(d.id) && d.fileUrl
    );
    for (const doc of docsWithUrls) {
      window.open(doc.fileUrl!, "_blank");
    }
  };

  const typeLabel = (t: string) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const confidenceColor = (c: number) =>
    c >= 0.8 ? "text-green-700" : c >= 0.5 ? "text-yellow-700" : "text-red-700";

  const statusBadge = (status: string | null) => {
    const colors: Record<string, string> = {
      missing: "bg-red-100 text-red-700",
      uploaded: "bg-blue-100 text-blue-700",
      extracted: "bg-yellow-100 text-yellow-700",
      verified: "bg-green-100 text-green-700",
    };
    return colors[status || ""] || "bg-gray-100 text-gray-600";
  };

  return (
    <div className="min-h-screen bg-[#f5f2ea] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-2xl font-bold text-[#1e2416]"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Documents
            </h1>
            <p className="text-sm text-[#6b7d52] mt-1">
              {documents.length} document{documents.length !== 1 ? "s" : ""}{" "}
              {txFilter ? "in this transaction" : "across all transactions"}
            </p>
          </div>
          <a
            href="/aire/documents/upload"
            className="px-4 py-2 bg-[#6b7d52] text-[#f5f2ea] rounded-lg text-sm font-medium hover:bg-[#5a6b44] transition-colors"
          >
            Upload Document
          </a>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-[#e8e4d8] p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 border border-[#e8e4d8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9aab7e]"
          />
          <select
            value={txFilter}
            onChange={(e) => setTxFilter(e.target.value)}
            className="px-3 py-2 border border-[#e8e4d8] rounded-lg text-sm bg-white max-w-[200px]"
          >
            <option value="">All Transactions</option>
            {transactions.map((tx) => (
              <option key={tx.id} value={tx.id}>
                {tx.propertyAddress}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-[#e8e4d8] rounded-lg text-sm bg-white"
          >
            <option value="">All Types</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-[#e8e4d8] rounded-lg text-sm bg-white"
          >
            <option value="">All Categories</option>
            <option value="mandatory">Mandatory</option>
            <option value="addendum">Addendum</option>
            <option value="federal">Federal</option>
            <option value="additional">Additional</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-[#e8e4d8] rounded-lg text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="missing">Missing</option>
            <option value="uploaded">Uploaded</option>
            <option value="extracted">Extracted</option>
            <option value="verified">Verified</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="bg-[#9aab7e]/10 border border-[#9aab7e] rounded-lg p-3 mb-4 flex items-center gap-3">
            <span className="text-sm text-[#1e2416] font-medium">
              {selectedIds.size} selected
            </span>
            <button
              onClick={bulkMarkVerified}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
            >
              Mark Verified
            </button>
            <button
              onClick={bulkDownload}
              className="px-3 py-1.5 bg-[#6b7d52] text-white rounded text-xs font-medium hover:bg-[#5a6b44] transition-colors"
            >
              Download
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-[#6b7d52] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-[#6b7d52]">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 text-[#6b7d52]">
            <svg
              className="mx-auto h-12 w-12 mb-3 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm font-medium">No documents found</p>
            <p className="text-xs mt-1 opacity-70">
              Upload your first PDF or adjust filters
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#e8e4d8] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e8e4d8] bg-[#f5f2ea]">
                  <th className="p-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === documents.length &&
                        documents.length > 0
                      }
                      onChange={selectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="p-3 text-left font-medium text-[#6b7d52]">
                    Filename
                  </th>
                  <th className="p-3 text-left font-medium text-[#6b7d52]">
                    Type
                  </th>
                  <th className="p-3 text-left font-medium text-[#6b7d52]">
                    Transaction
                  </th>
                  <th className="p-3 text-left font-medium text-[#6b7d52]">
                    Status
                  </th>
                  <th className="p-3 text-left font-medium text-[#6b7d52]">
                    Confidence
                  </th>
                  <th className="p-3 text-left font-medium text-[#6b7d52]">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-[#e8e4d8] hover:bg-[#f5f2ea]/50 transition-colors"
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-[#1e2416] truncate block max-w-[250px]">
                        {doc.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {doc.pageCount ? `${doc.pageCount} pg` : ""}
                        {doc.fileSize
                          ? `${doc.pageCount ? " · " : ""}${(doc.fileSize / 1024).toFixed(0)} KB`
                          : ""}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-[#9aab7e]/15 text-[#6b7d52] text-xs font-medium">
                        {typeLabel(doc.type)}
                      </span>
                      {doc.category && (
                        <span className="text-xs text-gray-400 ml-1">
                          {doc.category}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {doc.transaction ? (
                        <a
                          href={`/aire/transactions/${doc.transaction.id}`}
                          className="text-[#6b7d52] hover:underline text-xs"
                        >
                          {doc.transaction.propertyAddress}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          Unfiled
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(doc.checklistStatus)}`}
                      >
                        {doc.checklistStatus || "unknown"}
                      </span>
                    </td>
                    <td className="p-3">
                      {doc.classification?.confidence != null && (
                        <span
                          className={`text-xs font-mono ${confidenceColor(doc.classification.confidence)}`}
                        >
                          {(doc.classification.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-[#e8e4d8] flex justify-end">
              <FeedbackButtons feature="document_classification" metadata={{ documentCount: documents.length }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
