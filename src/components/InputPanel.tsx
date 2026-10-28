import React from 'react';
import { Play, Sparkles, User, Mail, FolderGit2, Calendar, FileText, CheckSquare, AlertCircle, Hash, RefreshCcw } from 'lucide-react';
import { EvaluationRequest } from '../types/evaluator';

interface InputPanelProps {
  request: EvaluationRequest;
  onChange: (field: keyof EvaluationRequest, value: string | number) => void;
  onSubmit: () => void;
  isLoading: boolean;
  benchmarkCount: number;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  request,
  onChange,
  onSubmit,
  isLoading,
  benchmarkCount,
}) => {
  const isFormValid =
    request.benchmarkRequirements.trim().length > 10 &&
    request.internSubmission.trim().length > 10;

  const currentMonth = Math.ceil(request.currentTaskNumber / 4);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* 48-Task Program Parameters */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Hash className="h-4 w-4 text-indigo-600" />
            48-Task Program Parameters (12 Months)
          </h2>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
            Month {currentMonth} of 12
          </span>
        </div>

        {/* Task Number & Attempt Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3.5">
          {/* Current Task Index */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <label htmlFor="task-number" className="block text-[11px] font-semibold text-slate-600 mb-1">
              Task Index (1 to 48)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="task-number"
                type="number"
                min={1}
                max={48}
                value={request.currentTaskNumber}
                onChange={(e) => onChange('currentTaskNumber', parseInt(e.target.value) || 1)}
                className="w-full text-sm font-bold text-indigo-600 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-400">/48</span>
            </div>
          </div>

          {/* Submission Attempt */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <label htmlFor="attempt-number" className="block text-[11px] font-semibold text-slate-600 mb-1">
              Submission Attempt
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="attempt-number"
                type="number"
                min={1}
                max={10}
                value={request.attemptNumber}
                onChange={(e) => onChange('attemptNumber', parseInt(e.target.value) || 1)}
                className="w-full text-sm font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-400">Try</span>
            </div>
          </div>

          {/* Candidate Name */}
          <div className="col-span-2 sm:col-span-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="intern-name" className="block text-[11px] font-semibold text-slate-600">
                Candidate Name &amp; Email
              </label>
              <button
                type="button"
                onClick={() => {
                  onChange('internName', 'Venkatesan');
                  onChange('internEmail', 'venkatesan8121972@gmail.com');
                }}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium cursor-pointer"
                title="Fill with your test email"
              >
                Set to venkatesan8121972@gmail.com
              </button>
            </div>
            <div className="flex gap-2">
              <input
                id="intern-name"
                type="text"
                value={request.internName}
                onChange={(e) => onChange('internName', e.target.value)}
                placeholder="Name (e.g., Alex Chen)"
                className="w-1/2 text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
              <input
                id="intern-email"
                type="email"
                value={request.internEmail}
                onChange={(e) => onChange('internEmail', e.target.value)}
                placeholder="Recipient Email"
                className="w-1/2 text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Task Milestone Name */}
        <div>
          <label htmlFor="task-name" className="block text-[11px] font-medium text-slate-600 mb-1">
            Task Milestone Title
          </label>
          <input
            id="task-name"
            type="text"
            value={request.taskName}
            onChange={(e) => onChange('taskName', e.target.value)}
            placeholder={`e.g. Task #${request.currentTaskNumber}: Architecture & API Service`}
            className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
          />
        </div>
      </div>

      {/* Two-Column Editor: Requirements & Submission */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col space-y-4 overflow-y-auto">
        {/* Section 1: Benchmark Requirements */}
        <div className="flex-1 flex flex-col min-h-[200px]">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                1
              </span>
              <label htmlFor="benchmark-input" className="text-xs sm:text-sm font-semibold text-slate-800">
                BENCHMARK REQUIREMENTS (Task {request.currentTaskNumber}/48)
              </label>
            </div>
            <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
              {benchmarkCount} criteria
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-1.5">
            Rubric criteria against which the submission is evaluated.
          </p>
          <textarea
            id="benchmark-input"
            aria-label="Benchmark technical requirements"
            value={request.benchmarkRequirements}
            onChange={(e) => onChange('benchmarkRequirements', e.target.value)}
            placeholder="1. BENCHMARK REQUIREMENTS&#10;- Criteria 1&#10;- Criteria 2"
            rows={6}
            className="w-full flex-1 font-mono text-xs p-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 transition-colors resize-y leading-relaxed"
          />
        </div>

        {/* Section 2: Candidate Submission */}
        <div className="flex-1 flex flex-col min-h-[200px]">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                2
              </span>
              <label htmlFor="submission-input" className="text-xs sm:text-sm font-semibold text-slate-800">
                CANDIDATE SUBMISSION (Attempt #{request.attemptNumber})
              </label>
            </div>
            <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
              {request.internSubmission.length} chars
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-1.5">
            Pull request notes, code summary, or commit report submitted by candidate.
          </p>
          <textarea
            id="submission-input"
            aria-label="Candidate submission content"
            value={request.internSubmission}
            onChange={(e) => onChange('internSubmission', e.target.value)}
            placeholder="2. CANDIDATE SUBMISSION&#10;Repository: ...&#10;Summary of deliverables..."
            rows={7}
            className="w-full flex-1 font-mono text-xs p-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 transition-colors resize-y leading-relaxed"
          />
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 text-indigo-500 flex-shrink-0" />
          <span>
            {request.currentTaskNumber === 48
              ? 'Final milestone: Passing triggers program graduation & certificate!'
              : 'Passing advances candidate to Task ' + (request.currentTaskNumber + 1) + '/48.'}
          </span>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!isFormValid || isLoading}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition-all ${
            !isFormValid || isLoading
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-500/25 active:scale-[0.98]'
          }`}
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Evaluating State Transition...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-indigo-200" />
              <span>Evaluate Task &amp; Trigger Transition</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
