import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { InputPanel } from './components/InputPanel';
import { EvaluationResults } from './components/EvaluationResults';
import { HistoryDrawer } from './components/HistoryDrawer';
import { SchemaGuideModal } from './components/SchemaGuideModal';
import { PRESET_BENCHMARKS } from './data/sample-data';
import {
  EvaluationRequest,
  WorkflowEvaluationResult,
  PresetBenchmark,
  SavedEvaluation,
} from './types/evaluator';
import { parseBenchmarkRequirements } from './utils/evaluator-rules';
import { AlertCircle, Sparkles, Award } from 'lucide-react';

const STORAGE_KEY = 'interneval_48task_history_v2';

export default function App() {
  const initialPreset = PRESET_BENCHMARKS[0];

  const [request, setRequest] = useState<EvaluationRequest>({
    internName: initialPreset.internName,
    internEmail: initialPreset.internEmail,
    taskName: initialPreset.taskName,
    currentTaskNumber: initialPreset.currentTaskNumber,
    attemptNumber: initialPreset.attemptNumber,
    dueDate: 'Sprint 2 Milestone Cycle',
    benchmarkRequirements: initialPreset.benchmarkRequirements,
    internSubmission: initialPreset.internSubmission,
  });

  const [result, setResult] = useState<WorkflowEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedEvaluation[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSchemaGuideOpen, setIsSchemaGuideOpen] = useState<boolean>(false);
  const [activeMobileView, setActiveMobileView] = useState<'input' | 'results'>('input');

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Could not load history from localStorage', e);
    }
  }, []);

  // Save history to localStorage
  const saveToHistory = (newResult: WorkflowEvaluationResult, currentRequest: EvaluationRequest) => {
    try {
      const newEntry: SavedEvaluation = {
        id: `eval_${Date.now()}`,
        timestamp: new Date().toISOString(),
        request: { ...currentRequest },
        result: newResult,
      };
      const updated = [newEntry, ...history.slice(0, 24)];
      setHistory(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save history to localStorage', e);
    }
  };

  const handleFieldChange = (field: keyof EvaluationRequest, value: string | number) => {
    setRequest((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectPreset = (preset: PresetBenchmark) => {
    setRequest({
      internName: preset.internName,
      internEmail: preset.internEmail,
      taskName: preset.taskName,
      currentTaskNumber: preset.currentTaskNumber,
      attemptNumber: preset.attemptNumber,
      dueDate: `Task ${preset.currentTaskNumber} Review Cycle`,
      benchmarkRequirements: preset.benchmarkRequirements,
      internSubmission: preset.internSubmission,
    });
    setResult(null);
    setError(null);
    setActiveMobileView('input');
  };

  const handleReset = () => {
    setRequest({
      internName: '',
      internEmail: '',
      taskName: '',
      currentTaskNumber: 1,
      attemptNumber: 1,
      dueDate: '',
      benchmarkRequirements: '',
      internSubmission: '',
    });
    setResult(null);
    setError(null);
    setActiveMobileView('input');
  };

  const handleEvaluate = async () => {
    if (!request.benchmarkRequirements.trim() || !request.internSubmission.trim()) {
      setError('Please provide both Benchmark Requirements and Candidate Submission.');
      return;
    }

    setIsEvaluating(true);
    setError(null);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete technical workflow evaluation.');
      }

      if (data.evaluation) {
        setResult(data.evaluation);
        saveToHistory(data.evaluation, request);
        setActiveMobileView('results');
      } else {
        throw new Error('Unexpected evaluation response structure.');
      }
    } catch (err: unknown) {
      console.error('Evaluation error:', err);
      const message = err instanceof Error ? err.message : 'Unknown evaluation error occurred.';
      setError(message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRestoreFromHistory = (saved: SavedEvaluation) => {
    setRequest(saved.request);
    setResult(saved.result);
    setError(null);
    setActiveMobileView('results');
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  };

  const benchmarkCount = parseBenchmarkRequirements(request.benchmarkRequirements).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 font-sans antialiased">
      {/* Navigation Header */}
      <Header
        onSelectPreset={handleSelectPreset}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSchemaGuide={() => setIsSchemaGuideOpen(true)}
        onReset={handleReset}
        historyCount={history.length}
        isEvaluating={isEvaluating}
        currentTaskNumber={request.currentTaskNumber}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col">
        {/* Error notification banner */}
        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between text-xs sm:text-sm animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-600 hover:text-rose-800 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Mobile View Switcher */}
        <div className="lg:hidden flex items-center justify-center p-1 bg-slate-200 rounded-xl mb-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMobileView('input')}
            className={`flex-1 py-2 rounded-lg text-center transition-colors ${
              activeMobileView === 'input'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            1. Task {request.currentTaskNumber}/48 Inputs
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileView('results')}
            className={`flex-1 py-2 rounded-lg text-center transition-colors ${
              activeMobileView === 'results'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            2. State Machine Outcome {result && '✓'}
          </button>
        </div>

        {/* Responsive Grid: Inputs vs Results */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch">
          {/* Left Column: Inputs Panel */}
          <div
            className={`lg:col-span-5 flex flex-col ${
              activeMobileView === 'input' ? 'block' : 'hidden lg:flex'
            }`}
          >
            <InputPanel
              request={request}
              onChange={handleFieldChange}
              onSubmit={handleEvaluate}
              isLoading={isEvaluating}
              benchmarkCount={benchmarkCount}
            />
          </div>

          {/* Right Column: Results Panel */}
          <div
            className={`lg:col-span-7 flex flex-col ${
              activeMobileView === 'results' ? 'block' : 'hidden lg:flex'
            }`}
          >
            {result ? (
              <EvaluationResults
                result={result}
                request={request}
                onReevaluate={handleEvaluate}
                isLoading={isEvaluating}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-8 sm:p-12 flex flex-col items-center justify-center text-center h-full min-h-[450px]">
                <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-2xs">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">
                  Task {request.currentTaskNumber}/48 State Machine Ready
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                  Click <strong>&quot;Evaluate Task &amp; Trigger Transition&quot;</strong> to evaluate Candidate {request.internName}&apos;s submission against benchmark criteria. The engine will calculate next action, prepare email dispatch, and generate a Vapi voice bot script.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleEvaluate}
                    disabled={isEvaluating}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Evaluate Task {request.currentTaskNumber}/48</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(PRESET_BENCHMARKS[1])}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition-colors"
                  >
                    Load Task 12 (Advance to Task 13)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(PRESET_BENCHMARKS[3])}
                    className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Award className="h-4 w-4 text-purple-600" />
                    <span>Load Task 48 Capstone (Graduation)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* History Drawer Modal */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={handleRestoreFromHistory}
        onClear={handleClearHistory}
      />

      {/* Schema Specification Modal */}
      <SchemaGuideModal
        isOpen={isSchemaGuideOpen}
        onClose={() => setIsSchemaGuideOpen(false)}
      />
    </div>
  );
}
