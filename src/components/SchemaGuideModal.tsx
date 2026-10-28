import React from 'react';
import { X, Code, ShieldAlert, Copy, Check, Terminal } from 'lucide-react';

interface SchemaGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchemaGuideModal: React.FC<SchemaGuideModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const schemaJson = `{
  "program_metadata": {
    "current_task": 1,
    "total_tasks": 48,
    "current_attempt": 1,
    "task_status": "PASSED" | "NEEDS_REVISION",
    "program_status": "IN_PROGRESS" | "INTERNSHIP_COMPLETED",
    "next_action": "ADVANCE_TO_NEXT_TASK" | "RETRY_CURRENT_TASK" | "GENERATE_COMPLETION_CERTIFICATE"
  },
  "evaluation_details": {
    "good_points": [
      "Completed benchmark item 1"
    ],
    "missed_points": [
      "Missed benchmark item 1"
    ],
    "required_updates": [
      "Clear step-by-step technical fix required"
    ]
  },
  "email_dispatch": {
    "subject": "Task 1/48 Evaluation Report - [Status]",
    "recipient_action_required": true | false,
    "next_review_datetime": "YYYY-MM-DD HH:MM",
    "body_html": "<p>Formatted HTML feedback email for Resend/Gmail API...</p>"
  },
  "voice_onboarding_script": {
    "trigger_call": true | false,
    "call_script": "Brief spoken script for Vapi/Voice bot explaining Task 2 if advancing."
  }
}`;

  const copySchema = () => {
    navigator.clipboard.writeText(schemaJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Code className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">48-Task Continuous Workflow Specification</h3>
              <p className="text-xs text-slate-500">State transitions, Vapi voice bot script, and email dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-700">
          {/* Rules Section */}
          <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <ShieldAlert className="h-4 w-4 text-indigo-600" />
              State Transition Rules (48 Tasks / 12 Months)
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-indigo-900 text-xs leading-relaxed">
              <li>
                <strong>Pass Criteria:</strong> If candidate meets all criteria for Task N:
                <br />
                <code className="bg-indigo-100 px-1 py-0.2 rounded font-mono">task_status: &quot;PASSED&quot;</code>,{' '}
                <code className="bg-indigo-100 px-1 py-0.2 rounded font-mono">next_action: &quot;ADVANCE_TO_NEXT_TASK&quot;</code>,{' '}
                <code className="bg-indigo-100 px-1 py-0.2 rounded font-mono">trigger_call: true</code> with preview of Task N+1.
              </li>
              <li>
                <strong>Revision Criteria:</strong> If candidate misses benchmark requirements:
                <br />
                <code className="bg-indigo-100 px-1 py-0.2 rounded font-mono">task_status: &quot;NEEDS_REVISION&quot;</code>,{' '}
                <code className="bg-indigo-100 px-1 py-0.2 rounded font-mono">next_action: &quot;RETRY_CURRENT_TASK&quot;</code>,{' '}
                <code className="bg-indigo-100 px-1 py-0.2 rounded font-mono">attempt_number: +1</code>,{' '}
                <code className="bg-indigo-100 px-1 py-0.2 rounded font-mono">recipient_action_required: true</code>.
              </li>
              <li>
                <strong>Final Task 48 Completion:</strong> If Task 48 passes:
                <br />
                <code className="bg-indigo-100 px-1 py-0.2 rounded font-mono">program_status: &quot;INTERNSHIP_COMPLETED&quot;</code>,{' '}
                <code className="bg-indigo-100 px-1 py-0.2 rounded font-mono">next_action: &quot;GENERATE_COMPLETION_CERTIFICATE&quot;</code>.
              </li>
            </ul>
          </div>

          {/* JSON Schema */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-900 text-xs">JSON Output Schema:</span>
              <button
                onClick={copySchema}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy Schema'}</span>
              </button>
            </div>
            <pre className="bg-slate-900 text-indigo-200 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
              <code>{schemaJson}</code>
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
