export type TaskStatus = 'PASSED' | 'NEEDS_REVISION';
export type ProgramStatus = 'IN_PROGRESS' | 'INTERNSHIP_COMPLETED';
export type NextAction = 'ADVANCE_TO_NEXT_TASK' | 'RETRY_CURRENT_TASK' | 'GENERATE_COMPLETION_CERTIFICATE';

export interface EvaluationSummary {
  task_status: TaskStatus;
  completion_score: number; // 0 to 100
  next_action: NextAction;
  strengths: string[];
  missed_requirements: string[];
  actionable_fixes: string[];
}

export interface EmailDispatch {
  to_subject: string;
  subject?: string;
  recipient_action_required?: boolean;
  next_review_datetime: string;
  meet_presentation_link: string;
  body_html: string;
}

export interface ProgramMetadata {
  current_task: number;
  total_tasks: number;
  current_attempt: number;
  task_status: TaskStatus;
  program_status: ProgramStatus;
  next_action: NextAction;
  completion_score?: number;
}

export interface EvaluationDetails {
  good_points: string[];
  missed_points: string[];
  required_updates: string[];
}

export interface VoiceOnboardingScript {
  trigger_call: boolean;
  call_script: string;
}

export interface WorkflowEvaluationResult {
  evaluation_summary: EvaluationSummary;
  email_dispatch: EmailDispatch;
  // Backward compatible properties for existing components
  program_metadata: ProgramMetadata;
  evaluation_details: EvaluationDetails;
  voice_onboarding_script: VoiceOnboardingScript;
}

export interface EvaluationRequest {
  internName: string;
  internEmail: string;
  taskName: string;
  currentTaskNumber: number; // 1 to 48
  attemptNumber: number; // 1, 2, 3...
  dueDate?: string;
  benchmarkRequirements: string;
  internSubmission: string;
}

export interface PresetBenchmark {
  id: string;
  title: string;
  category: 'Full-Stack' | 'Frontend' | 'Backend' | 'DevOps' | 'Data';
  currentTaskNumber: number;
  attemptNumber: number;
  internName: string;
  internEmail: string;
  taskName: string;
  expectedStatus: TaskStatus;
  benchmarkRequirements: string;
  internSubmission: string;
  notes: string;
}

export interface SavedEvaluation {
  id: string;
  timestamp: string;
  request: EvaluationRequest;
  result: WorkflowEvaluationResult;
}
