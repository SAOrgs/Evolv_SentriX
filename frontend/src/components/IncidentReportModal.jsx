import { useState } from "react";

export default function IncidentReportModal({ reportData, onClose }) {
  const [activeTab, setActiveTab] = useState("report"); // "report" | "channels" | "instruction"

  if (!reportData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="surface relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-red-500/30 bg-[#080e1e] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-red-500/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Emergency Response & Incident Report
              </h3>
              <p className="text-xs text-slate-400">
                Zone: <span className="font-semibold text-red-400">{reportData.zone_name || reportData.zone_id}</span> • Score: <span className="font-bold text-red-400">{reportData.risk_score}/100</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/[0.06] bg-[#050914] px-5 py-2">
          <button
            onClick={() => setActiveTab("report")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "report"
                ? "bg-white/[0.10] text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Draft Incident Report (Regulatory)
          </button>
          <button
            onClick={() => setActiveTab("instruction")}
            className={`ml-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "instruction"
                ? "bg-white/[0.10] text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Evacuation Instruction
          </button>
          <button
            onClick={() => setActiveTab("channels")}
            className={`ml-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "channels"
                ? "bg-white/[0.10] text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Notified Channels ({reportData.alert_channels?.length || 0})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "report" && (
            <div className="space-y-3">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300">
                Auto-drafted regulatory report compiled from live agent fusion findings.
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-300">
                {reportData.incident_report}
              </pre>
            </div>
          )}

          {activeTab === "instruction" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                  Evacuation Order
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">
                  {reportData.evacuation_instruction}
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Timestamp: {reportData.timestamp}
              </div>
            </div>
          )}

          {activeTab === "channels" && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-400">
                Targeted notification dispatch channels (mocked demo flow):
              </p>
              <ul className="space-y-2">
                {reportData.alert_channels?.map((ch, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-xs text-slate-300"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {ch}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#050914] px-5 py-3 text-xs">
          <span className="font-semibold text-amber-400">
            {reportData.status || "MOCKED - no real notifications sent"}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 py-1.5 font-semibold text-slate-300 hover:bg-white/[0.10] hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
