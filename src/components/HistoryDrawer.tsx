import React from 'react';
import { X, Clock, Trash2, ArrowUpRight, ShieldCheck, ShieldAlert, Award } from 'lucide-react';
import { SavedEvaluation } from '../types/evaluator';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: SavedEvaluation[];
  onSelect: (item: SavedEvaluation) => void;
  onClear: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onClear,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">48-Task Evaluation History</h3>
            <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
              {history.length}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close history drawer"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No previous evaluations yet.</p>
              <p className="mt-1 text-slate-400">Run a task evaluation to archive workflow transitions here.</p>
            </div>
          ) : (
            history.map((item) => {
              const meta = item.result.program_metadata;
              const isPassed = meta?.task_status === 'PASSED';
              const isGraduated = meta?.program_status === 'INTERNSHIP_COMPLETED';
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="group p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-slate-50/80 cursor-pointer transition-all shadow-2xs hover:shadow-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isPassed ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                        {meta?.task_status}
                      </span>
                      <span className="text-[11px] font-bold font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                        Task {meta?.current_task}/48
                      </span>
                    </div>

                    {isGraduated && (
                      <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Award className="h-3 w-3" /> Graduated
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {item.request.taskName || `Task ${meta?.current_task}`}
                  </h4>

                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                    Candidate: <span className="font-medium text-slate-700">{item.request.internName}</span> (Attempt #{meta?.current_attempt})
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-600">
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                    <span className="text-indigo-600 font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Restore <ArrowUpRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              onClick={onClear}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1.5 py-1 px-2 rounded hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear History</span>
            </button>
            <span className="text-[11px] text-slate-600 font-mono">Stored in browser</span>
          </div>
        )}
      </div>
    </div>
  );
};
