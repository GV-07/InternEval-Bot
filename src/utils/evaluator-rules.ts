import {
  EvaluationRequest,
  WorkflowEvaluationResult,
  EvaluationSummary,
  EmailDispatch,
  TaskStatus,
  ProgramStatus,
  NextAction,
} from '../types/evaluator';

/**
 * Validates whether an object matches the exact evaluation schema:
 * {
 *   evaluation_summary: { task_status, completion_score, next_action, strengths, missed_requirements, actionable_fixes },
 *   email_dispatch: { to_subject, next_review_datetime, meet_presentation_link, body_html }
 * }
 */
export function validateWorkflowEvaluationResult(data: unknown): {
  valid: boolean;
  errors: string[];
  result?: WorkflowEvaluationResult;
} {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input data must be an object'] };
  }

  const obj = data as Record<string, any>;

  // Check for evaluation_summary (or legacy program_metadata)
  const summary = obj.evaluation_summary || obj.program_metadata;
  if (!summary || typeof summary !== 'object') {
    errors.push('Field "evaluation_summary" is required and must be an object');
  }

  // Check for email_dispatch
  if (!obj.email_dispatch || typeof obj.email_dispatch !== 'object') {
    errors.push('Field "email_dispatch" is required and must be an object');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const result = enforceWorkflowTransitionRules(obj as any);
  return { valid: true, errors: [], result };
}

/**
 * Enforces transition rules and normalizes result to always have both:
 * - evaluation_summary & email_dispatch (canonical)
 * - program_metadata, evaluation_details, voice_onboarding_script (convenience aliases)
 */
export function enforceWorkflowTransitionRules(
  raw: any
): WorkflowEvaluationResult {
  const summaryRaw = raw.evaluation_summary || {};
  const metaRaw = raw.program_metadata || {};
  const detailsRaw = raw.evaluation_details || {};
  const emailRaw = raw.email_dispatch || {};
  const voiceRaw = raw.voice_onboarding_script || {};

  // Extract strengths / good points
  const strengths: string[] = Array.isArray(summaryRaw.strengths)
    ? summaryRaw.strengths
    : Array.isArray(detailsRaw.good_points)
    ? detailsRaw.good_points
    : [];

  // Extract missed requirements
  const missed_requirements: string[] = Array.isArray(summaryRaw.missed_requirements)
    ? summaryRaw.missed_requirements
    : Array.isArray(detailsRaw.missed_points)
    ? detailsRaw.missed_points
    : [];

  // Extract actionable fixes / required updates
  const actionable_fixes: string[] = Array.isArray(summaryRaw.actionable_fixes)
    ? summaryRaw.actionable_fixes
    : Array.isArray(detailsRaw.required_updates)
    ? detailsRaw.required_updates
    : [];

  // Task Status: If missed items exist, must be NEEDS_REVISION
  let task_status: TaskStatus = summaryRaw.task_status || metaRaw.task_status || 'NEEDS_REVISION';
  if (missed_requirements.length > 0) {
    task_status = 'NEEDS_REVISION';
  } else if (strengths.length > 0 && missed_requirements.length === 0) {
    task_status = 'PASSED';
  }

  // Next Action
  let next_action: NextAction = task_status === 'PASSED' ? 'ADVANCE_TO_NEXT_TASK' : 'RETRY_CURRENT_TASK';

  // Completion score calculation (0 - 100)
  let completion_score: number = typeof summaryRaw.completion_score === 'number'
    ? summaryRaw.completion_score
    : 0;

  if (completion_score === 0 || isNaN(completion_score)) {
    const totalItems = strengths.length + missed_requirements.length;
    if (totalItems > 0) {
      completion_score = Math.round((strengths.length / totalItems) * 100);
      if (task_status === 'PASSED' && completion_score < 80) completion_score = 90;
      if (task_status === 'NEEDS_REVISION' && completion_score > 75) completion_score = 65;
    } else {
      completion_score = task_status === 'PASSED' ? 95 : 50;
    }
  }

  const currentTask = Math.min(48, Math.max(1, Number(metaRaw.current_task) || 1));
  const currentAttempt = Math.max(1, Number(metaRaw.current_attempt) || 1);
  const program_status: ProgramStatus = (currentTask >= 48 && task_status === 'PASSED') ? 'INTERNSHIP_COMPLETED' : 'IN_PROGRESS';

  // Email dispatch normalization
  const to_subject = emailRaw.to_subject || emailRaw.subject || `Task Review Feedback: Task #${currentTask} - ${task_status}`;
  const next_review_datetime = emailRaw.next_review_datetime || '2026-10-30 18:00 IST';
  const meet_presentation_link = emailRaw.meet_presentation_link || 'https://meet.google.com/xyz-abc-def';
  const body_html = emailRaw.body_html || '';

  const evaluation_summary: EvaluationSummary = {
    task_status,
    completion_score,
    next_action,
    strengths,
    missed_requirements,
    actionable_fixes,
  };

  const email_dispatch: EmailDispatch = {
    to_subject,
    subject: to_subject,
    recipient_action_required: task_status !== 'PASSED',
    next_review_datetime,
    meet_presentation_link,
    body_html,
  };

  const program_metadata = {
    current_task: currentTask,
    total_tasks: 48,
    current_attempt: currentAttempt,
    task_status,
    program_status,
    next_action,
    completion_score,
  };

  const evaluation_details = {
    good_points: strengths,
    missed_points: missed_requirements,
    required_updates: actionable_fixes,
  };

  const voice_onboarding_script = {
    trigger_call: true,
    call_script: voiceRaw.call_script && voiceRaw.call_script.length > 50
      ? voiceRaw.call_script
      : generateMentorVoiceScript({
          internName: 'Intern',
          taskNumber: currentTask,
          nextReviewDateTime: next_review_datetime,
          meetLink: meet_presentation_link,
          taskStatus: task_status,
        }),
  };

  return {
    evaluation_summary,
    email_dispatch,
    program_metadata,
    evaluation_details,
    voice_onboarding_script,
  };
}

/**
 * Parse benchmark text into individual checklist criteria lines.
 */
export function parseBenchmarkRequirements(benchmarkText: string): string[] {
  return benchmarkText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.toUpperCase().includes('BENCHMARK REQUIREMENTS')) return false;
      if (line.startsWith('#')) return false;
      return true;
    })
    .map((line) => line.replace(/^[-*•\d+.)\]\s]+/, '').trim())
    .filter((line) => line.length > 3);
}

/**
 * Deterministic technical evaluator strictly implementing the user prompt rules and output schema.
 */
export function generateDeterministicWorkflowEvaluation(
  req: EvaluationRequest
): WorkflowEvaluationResult {
  const criteria = parseBenchmarkRequirements(req.benchmarkRequirements);
  const submissionLower = req.internSubmission.toLowerCase();

  const strengths: string[] = [];
  const missed_requirements: string[] = [];
  const actionable_fixes: string[] = [];

  const SYNONYM_MAP: Record<string, string[]> = {
    accessibility: ['a11y', 'axe', 'aria', 'screen reader', 'wcag'],
    wcag: ['a11y', 'axe', 'accessibility', 'aria'],
    keyboard: ['keyboard', 'tab', 'escape', 'traversal', 'shortcut'],
    theme: ['dark mode', 'theme', 'prefers-color-scheme', 'color-scheme'],
    storybook: ['storybook', 'autodocs', 'component docs'],
    documentation: ['storybook', 'docs', 'readme', 'autodocs'],
    tests: ['test', 'vitest', 'jest', 'coverage', 'unit tests'],
    rate: ['rate limit', 'rate-limit', 'throttle'],
    expiration: ['expiration', 'expiry', 'expiresin', 'ttl', 'refresh token'],
    docker: ['docker', 'dockerfile', 'container'],
    kafka: ['kafka', 'producer', 'consumer', 'topic'],
    migration: ['migration', 'migrate', 'schema migration', 'up', 'down'],
  };

  criteria.forEach((criterion) => {
    const critLower = criterion.toLowerCase();
    const tokens = critLower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['must', 'should', 'with', 'using', 'that', 'from', 'each', 'need', 'have'].includes(w));

    let matchCount = 0;
    for (const tok of tokens) {
      if (submissionLower.includes(tok)) {
        matchCount++;
      } else {
        const syns = SYNONYM_MAP[tok] || [];
        if (syns.some((syn) => submissionLower.includes(syn))) {
          matchCount++;
        }
      }
    }

    const threshold = Math.max(1, Math.min(2, Math.floor(tokens.length * 0.45)));
    if (tokens.length === 0 || matchCount >= threshold) {
      strengths.push(criterion);
    } else {
      missed_requirements.push(criterion);
      actionable_fixes.push(
        `Implement and test "${criterion}" according to the technical rubric specifications and verify with automated checks.`
      );
    }
  });

  if (strengths.length === 0 && criteria.length > 0) {
    strengths.push('Basic project architecture and submission document structure initialized.');
  }

  const currentTask = Math.min(48, Math.max(1, Number(req.currentTaskNumber) || 1));
  const currentAttempt = Math.max(1, Number(req.attemptNumber) || 1);

  // EVALUATION RULES:
  // 1. If all core requirements are satisfied -> task_status = "PASSED", next_action = "ADVANCE_TO_NEXT_TASK"
  // 2. If essential requirements are missing, broken, or incomplete -> task_status = "NEEDS_REVISION", next_action = "RETRY_CURRENT_TASK"
  const task_status: TaskStatus = missed_requirements.length === 0 ? 'PASSED' : 'NEEDS_REVISION';
  const next_action: NextAction = task_status === 'PASSED' ? 'ADVANCE_TO_NEXT_TASK' : 'RETRY_CURRENT_TASK';

  // Completion score
  let completion_score = 85;
  if (criteria.length > 0) {
    completion_score = Math.round((strengths.length / (strengths.length + missed_requirements.length)) * 100);
    if (task_status === 'PASSED' && completion_score < 80) completion_score = 90;
    if (task_status === 'NEEDS_REVISION' && completion_score > 75) completion_score = 65;
  } else {
    completion_score = task_status === 'PASSED' ? 95 : 55;
  }

  // Next review window (format: YYYY-MM-DD HH:MM IST)
  const reviewTarget = new Date();
  reviewTarget.setDate(reviewTarget.getDate() + (task_status === 'PASSED' ? 7 : 2));
  const yyyy = reviewTarget.getFullYear();
  const mm = String(reviewTarget.getMonth() + 1).padStart(2, '0');
  const dd = String(reviewTarget.getDate()).padStart(2, '0');
  const next_review_datetime = `${yyyy}-${mm}-${dd} 18:00 IST`;

  const internName = req.internName || 'Intern';
  const to_subject = `Task Review Feedback: Task #${currentTask} - ${task_status}`;
  const meet_presentation_link = 'https://meet.google.com/xyz-abc-def';

  // Status badge styling matching user's template
  const statusColor = task_status === 'PASSED' ? '#0f9d58' : '#e37400';
  const statusBadge = `<span style='background-color: ${statusColor}; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;'>${task_status} (${completion_score}%)</span>`;

  const strengthsListHtml = strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  const missedListHtml = missed_requirements.length > 0
    ? missed_requirements.map((m) => `<li>${escapeHtml(m)}</li>`).join('')
    : '<li>None. All benchmark requirements successfully satisfied!</li>';
  const fixesListHtml = actionable_fixes.length > 0
    ? actionable_fixes.map((f) => `<li>${escapeHtml(f)}</li>`).join('')
    : '<li>Proceed to fetch the next milestone task specification.</li>';

  // EXACT HTML Report Email format requested by user:
  const body_html = `<div style='font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;'><h2 style='color: #1a73e8; margin-top: 0;'>Task Evaluation Report</h2><p>Hello <b>${escapeHtml(internName)}</b>,</p><p>Your submission has been reviewed by the AI Supervisor system.</p><div style='background-color: #f8f9fa; padding: 12px; border-left: 4px solid #1a73e8; margin: 15px 0;'><strong>Status:</strong> ${statusBadge}<br><strong>Next Review Window:</strong> ${next_review_datetime}<br><strong>Presentation Link:</strong> <a href='${meet_presentation_link}' style='color: #1a73e8; font-weight: bold;'>Join Google Meet</a></div><h3>What Went Well</h3><ul>${strengthsListHtml}</ul><h3>Missed Requirements & Items to Add</h3><ul>${missedListHtml}</ul><h3>Required Updates & Implementation Steps</h3><ol>${fixesListHtml}</ol><hr style='border: 0; border-top: 1px solid #eee; margin: 20px 0;'><p style='font-size: 13px; color: #666;'>Please upload your updated work to the bot before the next review window.</p></div>`.trim();

  const evaluation_summary: EvaluationSummary = {
    task_status,
    completion_score,
    next_action,
    strengths,
    missed_requirements,
    actionable_fixes,
  };

  const email_dispatch: EmailDispatch = {
    to_subject,
    subject: to_subject,
    recipient_action_required: task_status !== 'PASSED',
    next_review_datetime,
    meet_presentation_link,
    body_html,
  };

  const program_metadata = {
    current_task: currentTask,
    total_tasks: 48,
    current_attempt: currentAttempt,
    task_status,
    program_status: (currentTask >= 48 && task_status === 'PASSED') ? ('INTERNSHIP_COMPLETED' as ProgramStatus) : ('IN_PROGRESS' as ProgramStatus),
    next_action,
    completion_score,
  };

  const evaluation_details = {
    good_points: strengths,
    missed_points: missed_requirements,
    required_updates: actionable_fixes,
  };

  const mentorVoiceScript = generateMentorVoiceScript({
    internName,
    taskNumber: currentTask,
    taskName: req.taskName,
    nextReviewDateTime: next_review_datetime,
    meetLink: meet_presentation_link,
    taskStatus: task_status,
  });

  const voice_onboarding_script = {
    trigger_call: true,
    call_script: mentorVoiceScript,
  };

  return {
    evaluation_summary,
    email_dispatch,
    program_metadata,
    evaluation_details,
    voice_onboarding_script,
  };
}

/**
 * Generates an encouraging 2-minute task onboarding call script
 * matching the AI Technical Mentor goals and structured tone.
 */
export function generateMentorVoiceScript(params: {
  internName: string;
  taskNumber: number;
  taskName?: string;
  nextReviewDateTime: string;
  meetLink?: string;
  taskStatus?: TaskStatus;
}): string {
  const {
    internName,
    taskNumber,
    taskName = 'Milestone Technical Task',
    nextReviewDateTime,
    meetLink = 'https://meet.google.com/xyz-abc-def',
  } = params;

  return `Hello ${internName}! Welcome to your weekly task onboarding session. I'm your AI Technical Mentor, and I'm really excited to walk you through your goals for Task #${taskNumber} of 48: ${taskName}.

Over the next two minutes, let's break down your core objectives. For this sprint, your primary objective is to architect, implement, and thoroughly validate your technical solution against the milestone benchmark criteria. Focus on writing clean, modular code, handling potential edge cases defensively, and ensuring all automated unit checks execute reliably.

Regarding your key deliverables: make sure your complete code repository is pushed to your feature branch with a well-structured pull request, accompanied by automated test suites verifying each core benchmark requirement. Your official submission deadline is set prior to our review window.

Please remember that your full review schedule details—including the exact date, time, and your dedicated Google Meet presentation link—have already been dispatched to your email inbox. You can also refer to your evaluation report dashboard anytime.

Before you dive in and write that first line of code, do you have any quick questions or anything you'd like me to clarify about the task requirements?`;
}

/**
 * Generates a clean HTML email informing the intern about their newly assigned task
 * and upcoming review presentation schedule, matching the AI Internship Coordinator specification.
 */
export function generateAssignmentScheduleEmail(params: {
  internName: string;
  taskNumber: number;
  reviewDateTime: string;
  meetLink: string;
}): { subject: string; body_html: string } {
  const { internName, taskNumber, reviewDateTime, meetLink } = params;
  return {
    subject: `Task ${taskNumber} Assignment & Presentation Review Schedule`,
    body_html: `<div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'><h2 style='color: #1a73e8;'>Task #${taskNumber} Assigned</h2><p>Hello <b>${escapeHtml(internName)}</b>,</p><p>Your next weekly task is unlocked. Please note your presentation review schedule below:</p><ul><li><b>Review Date & Time:</b> ${escapeHtml(reviewDateTime)}</li><li><b>Presentation Link:</b> <a href='${meetLink}'>${meetLink}</a></li></ul><p>Please submit your completed project work to the bot prior to the review window.</p></div>`.trim(),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
