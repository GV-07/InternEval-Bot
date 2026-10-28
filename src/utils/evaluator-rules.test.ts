import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWorkflowEvaluationResult,
  enforceWorkflowTransitionRules,
  parseBenchmarkRequirements,
  generateDeterministicWorkflowEvaluation,
} from './evaluator-rules';
import { WorkflowEvaluationResult, EvaluationRequest } from '../types/evaluator';

test('validateWorkflowEvaluationResult validates correct 48-task schema', () => {
  const validPayload: WorkflowEvaluationResult = {
    program_metadata: {
      current_task: 12,
      total_tasks: 48,
      current_attempt: 1,
      task_status: 'PASSED',
      program_status: 'IN_PROGRESS',
      next_action: 'ADVANCE_TO_NEXT_TASK',
    },
    evaluation_details: {
      good_points: ['Docker containerized successfully'],
      missed_points: [],
      required_updates: [],
    },
    email_dispatch: {
      to_subject: 'Task 12/48 Evaluation Report - Passed',
      subject: 'Task 12/48 Evaluation Report - Passed',
      recipient_action_required: false,
      next_review_datetime: '2026-11-04 17:00',
      meet_presentation_link: 'https://meet.google.com/xyz-abc-def',
      body_html: '<p>Well done</p>',
    },
    voice_onboarding_script: {
      trigger_call: true,
      call_script: 'Hello, great job on Task 12! Ready for Task 13?',
    },
    evaluation_summary: {
      task_status: 'PASSED',
      completion_score: 95,
      next_action: 'ADVANCE_TO_NEXT_TASK',
      strengths: ['Docker containerized successfully'],
      missed_requirements: [],
      actionable_fixes: [],
    },
  };

  const validation = validateWorkflowEvaluationResult(validPayload);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});

test('State Transition: Missed points forces NEEDS_REVISION and RETRY_CURRENT_TASK', () => {
  const resultWithGaps: WorkflowEvaluationResult = {
    program_metadata: {
      current_task: 5,
      total_tasks: 48,
      current_attempt: 1,
      task_status: 'PASSED', // Incorrectly marked passed
      program_status: 'IN_PROGRESS',
      next_action: 'ADVANCE_TO_NEXT_TASK',
    },
    evaluation_details: {
      good_points: ['Auth middleware working'],
      missed_points: ['Missing rate limit on login endpoint'],
      required_updates: ['Add express-rate-limit'],
    },
    email_dispatch: {
      to_subject: 'Report',
      subject: 'Report',
      recipient_action_required: false,
      next_review_datetime: '2026-10-30 17:00',
      meet_presentation_link: 'https://meet.google.com/xyz-abc-def',
      body_html: '<p>Fix</p>',
    },
    voice_onboarding_script: {
      trigger_call: true,
      call_script: 'Advance',
    },
    evaluation_summary: {
      task_status: 'PASSED',
      completion_score: 50,
      next_action: 'ADVANCE_TO_NEXT_TASK',
      strengths: ['Auth middleware working'],
      missed_requirements: ['Missing rate limit on login endpoint'],
      actionable_fixes: ['Add express-rate-limit'],
    },
  };

  const enforced = enforceWorkflowTransitionRules(resultWithGaps);
  assert.equal(enforced.program_metadata.task_status, 'NEEDS_REVISION');
  assert.equal(enforced.program_metadata.next_action, 'RETRY_CURRENT_TASK');
  assert.equal(enforced.email_dispatch.recipient_action_required, true);
  assert.equal(enforced.voice_onboarding_script.trigger_call, false);
});

test('State Transition: Task 48 Completion triggers GENERATE_COMPLETION_CERTIFICATE and INTERNSHIP_COMPLETED', () => {
  const finalTaskReq: EvaluationRequest = {
    internName: 'Elena Rostova',
    internEmail: 'elena@example.com',
    taskName: 'Capstone Project Production Release',
    currentTaskNumber: 48,
    attemptNumber: 1,
    benchmarkRequirements: `
- Deploy multi-region Kubernetes cluster
- Verify zero-downtime blue-green deployment
`,
    internSubmission: `
Deployed Kubernetes cluster across 3 regions.
Executed blue-green deployment with 0 dropped requests verified by Datadog APM.
`,
  };

  const evalResult = generateDeterministicWorkflowEvaluation(finalTaskReq);
  assert.equal(evalResult.program_metadata.current_task, 48);
  assert.equal(evalResult.program_metadata.task_status, 'PASSED');
  assert.equal(evalResult.program_metadata.program_status, 'INTERNSHIP_COMPLETED');
  assert.equal(evalResult.program_metadata.next_action, 'GENERATE_COMPLETION_CERTIFICATE');
  assert.equal(evalResult.voice_onboarding_script.trigger_call, true);
  assert.ok(evalResult.voice_onboarding_script.call_script.includes('completed your 12-month'));
});

test('State Transition: Intermediate Task N < 48 advances to next task', () => {
  const intermediateReq: EvaluationRequest = {
    internName: 'Maya Lin',
    internEmail: 'maya@example.com',
    taskName: 'Accessible UI Library',
    currentTaskNumber: 15,
    attemptNumber: 1,
    benchmarkRequirements: `
- Build reusable Button component
- Ensure WCAG accessibility
`,
    internSubmission: `
Built reusable Button component.
Full WCAG accessibility verified with axe test suite.
`,
  };

  const evalResult = generateDeterministicWorkflowEvaluation(intermediateReq);
  assert.equal(evalResult.program_metadata.current_task, 15);
  assert.equal(evalResult.program_metadata.task_status, 'PASSED');
  assert.equal(evalResult.program_metadata.program_status, 'IN_PROGRESS');
  assert.equal(evalResult.program_metadata.next_action, 'ADVANCE_TO_NEXT_TASK');
  assert.equal(evalResult.voice_onboarding_script.trigger_call, true);
  assert.ok(evalResult.voice_onboarding_script.call_script.includes('Task 16'));
});
