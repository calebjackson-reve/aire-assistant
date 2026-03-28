"use client";

import { useEffect, useState } from "react";

interface Transaction {
  id: string;
  propertyAddress: string;
  propertyCity: string;
  status: string;
  acceptedPrice: number | null;
  closingDate: string | null;
  buyerName: string | null;
  sellerName: string | null;
  createdAt: string;
}

interface Deadline {
  id: string;
  name: string;
  dueDate: string;
  transactionId: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-700",
  ACTIVE: "bg-blue-600",
  PENDING_INSPECTION: "bg-amber-600",
  PENDING_APPRAISAL: "bg-orange-600",
  PENDING_FINANCING: "bg-purple-600",
  CLOSING: "bg-emerald-600",
  CLOSED: "bg-green-700",
  CANCELLED: "bg-red-700",
};

export default function TransactionsCommandCenter() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Deadline[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    try {
      const res = await fetch("/api/transactions");
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setUpcomingDeadlines(data.upcomingDeadlines || []);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  }

  function daysUntil(dateStr: string): number {
    const now = new Date();
    const target = new Date(dateStr);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Command Center</h1>
            <p className="text-zinc-400 mt-1">
              {transactions.length} active transactions
            </p>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            + New Transaction
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-sm">Active Deals</p>
            <p className="text-3xl font-bold mt-1">
              {transactions.filter((t) => !["CLOSED", "CANCELLED"].includes(t.status)).length}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-sm">Pipeline Value</p>
            <p className="text-3xl font-bold mt-1">
              ${transactions
                .filter((t) => !["CLOSED", "CANCELLED"].includes(t.status))
                .reduce((sum, t) => sum + (t.acceptedPrice || 0), 0)
                .toLocaleString()}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-sm">Closing This Month</p>
            <p className="text-3xl font-bold mt-1">
              {transactions.filter((t) => {
                if (!t.closingDate) return false;
                const closing = new Date(t.closingDate);
                const now = new Date();
                return closing.getMonth() === now.getMonth() && closing.getFullYear() === now.getFullYear();
              }).length}
            </p>
          </div>
          <div className="bg-zinc-900 border border-amber-700/50 rounded-xl p-5">
            <p className="text-amber-400 text-sm">Upcoming Deadlines</p>
            <p className="text-3xl font-bold mt-1 text-amber-300">
              {upcomingDeadlines.length}
            </p>
          </div>
        </div>

        {/* Two columns: Timeline + Deadlines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Transaction Grid */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Transactions</h2>
            {loading ? (
              <div className="text-zinc-500">Loading...</div>
            ) : transactions.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                <p className="text-zinc-400 text-lg">No transactions yet</p>
                <p className="text-zinc-600 mt-2">
                  Create your first transaction to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {tx.propertyAddress}
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          {tx.propertyCity} &middot;{" "}
                          {tx.buyerName || tx.sellerName || "No parties added"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {tx.acceptedPrice && (
                          <span className="text-zinc-300 font-mono">
                            ${tx.acceptedPrice.toLocaleString()}
                          </span>
                        )}
                        <span
                          className={`${STATUS_COLORS[tx.status] || "bg-zinc-700"} px-3 py-1 rounded-full text-xs font-semibold`}
                        >
                          {tx.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    {tx.closingDate && (
                      <p className="text-zinc-500 text-xs mt-2">
                        Closing: {new Date(tx.closingDate).toLocaleDateString()} ({daysUntil(tx.closingDate)} days)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deadline Alerts */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Deadline Alerts</h2>
            {upcomingDeadlines.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                <p className="text-zinc-500">No upcoming deadlines</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((dl) => {
                  const days = daysUntil(dl.dueDate);
                  const urgent = days <= 1;
                  return (
                    <div
                      key={dl.id}
                      className={`rounded-xl p-4 border ${
                        urgent
                          ? "bg-red-950/50 border-red-700"
                          : "bg-zinc-900 border-zinc-800"
                      }`}
                    >
                      <p className={`font-semibold ${urgent ? "text-red-300" : "text-white"}`}>
                        {dl.name}
                      </p>
                      <p className="text-zinc-400 text-sm mt-1">
                        Due: {new Date(dl.dueDate).toLocaleDateString()} ({days} day{days !== 1 ? "s" : ""})
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Voice Command Bar placeholder */}
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <button className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <div className="flex-1 bg-zinc-800 rounded-lg px-4 py-3 text-zinc-400">
              Press microphone or type a command... &quot;Create addendum for 123 Main St&quot;
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
