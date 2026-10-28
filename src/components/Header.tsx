import React from 'react';
import { Bot, Sparkles, History, RotateCcw, Code, Award } from 'lucide-react';
import { PresetBenchmark } from '../types/evaluator';

interface HeaderProps {
  onSelectPreset?: (preset: PresetBenchmark) => void;
  onOpenHistory: () => void;
  onOpenSchemaGuide: () => void;
  onReset: () => void;
  historyCount: number;
  isEvaluating: boolean;
  currentTaskNumber: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHistory,
  onOpenSchemaGuide,
  onReset,
  historyCount,
  isEvaluating,
  currentTaskNumber,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 flex-shrink-0">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-bold text-sm sm:text-lg tracking-tight text-white whitespace-nowrap">InternEval AI</span>
              <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                48-Task Engine
              </span>
              <div className="hidden xl:flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60" title="Gemini 3.8 Flash active">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Gemini 3.8
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-950/80 text-teal-300 border border-teal-700/60" title="Resend Live SMTP (noreply@resend.dev)">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  Resend
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-950/80 text-sky-300 border border-sky-700/60" title="Telegram Bot connected">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  Telegram
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/60" title="Supabase PostgreSQL connected">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  PostgreSQL
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              12-Month Multi-Task Continuous Workflow, Telegram Alerts &amp; Voice Dispatch
            </p>
          </div>
        </div>

        {/* Center Task Tracker Indicator */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs">
          <span className="text-slate-400 font-medium">Program Milestone:</span>
          <span className="font-bold text-indigo-400 font-mono">Task {currentTaskNumber}/48</span>
          <div className="w-20 bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.round((currentTaskNumber / 48) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {Math.round((currentTaskNumber / 48) * 100)}%
          </span>
        </div>

        {/* Actions & Controls */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Reset button */}
          <button
            type="button"
            onClick={onReset}
            disabled={isEvaluating}
            aria-label="Reset input fields"
            className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            title="Reset form"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden md:inline">Reset</span>
          </button>

          {/* History button */}
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label="View evaluation history"
            className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 relative"
          >
            <History className="h-4 w-4 text-slate-400" />
            <span className="hidden md:inline">History</span>
            {historyCount > 0 && (
              <span className="bg-indigo-600 text-white font-bold text-[10px] rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                {historyCount}
              </span>
            )}
          </button>

          {/* Schema Guide */}
          <button
            type="button"
            onClick={onOpenSchemaGuide}
            aria-label="View 48-task workflow schema spec"
            className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">Schema &amp; API</span>
          </button>
        </div>
      </div>
    </header>
  );
};
