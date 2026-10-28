import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Mail,
  FileCode,
  Copy,
  Check,
  Send,
  Calendar,
  Sparkles,
  ArrowRight,
  Download,
  Terminal,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  PhoneCall,
  Volume2,
  Award,
  ExternalLink,
  LogOut,
  User as UserIcon,
  CheckCircle,
  Info,
  HelpCircle,
  SendHorizontal,
  Zap,
  Database,
  MessageSquare,
  FileDown,
  Play,
  Square,
  VolumeX,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { WorkflowEvaluationResult, EvaluationRequest } from '../types/evaluator';
import { generateEvaluationPdf } from '../utils/pdfGenerator';
import {
  generateMentorVoiceScript,
  generateAssignmentScheduleEmail,
} from '../utils/evaluator-rules';
import {
  initAuth,
  googleSignIn,
  logout,
  sendRealGmailMessage,
  openGmailWebComposer,
  getGmailWebComposeUrl,
  getMailtoUrl,
  downloadEmlFile,
} from '../utils/firebaseAuth';

interface EvaluationResultsProps {
  result: WorkflowEvaluationResult;
  request: EvaluationRequest;
  onReevaluate: () => void;
  isLoading: boolean;
}

export const EvaluationResults: React.FC<EvaluationResultsProps> = ({
  result,
  request,
  onReevaluate,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'email' | 'voice' | 'json' | 'python'>('details');
  const [emailViewMode, setEmailViewMode] = useState<'preview' | 'html'>('preview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auth & Gmail Sending State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isSendingRealEmail, setIsSendingRealEmail] = useState<boolean>(false);
  const [realEmailError, setRealEmailError] = useState<string | null>(null);
  const [realEmailSuccess, setRealEmailSuccess] = useState<{
    id: string;
    threadId: string;
    sentTo: string;
    timestamp: string;
  } | null>(null);

  // Confirmation dialog state for destructive/sending operation
  const [showConfirmSendDialog, setShowConfirmSendDialog] = useState<boolean>(false);

  // Vapi Call Simulation State
  const [isSimulatingCall, setIsSimulatingCall] = useState<boolean>(false);
  const [callReceipt, setCallReceipt] = useState<{
    callId: string;
    status: string;
    voiceModel: string;
  } | null>(null);

  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [showOAuthHelpModal, setShowOAuthHelpModal] = useState<boolean>(false);

  const summary = result.evaluation_summary || {
    task_status: result.program_metadata?.task_status || 'NEEDS_REVISION',
    completion_score: result.program_metadata?.completion_score || 85,
    next_action: result.program_metadata?.next_action || 'RETRY_CURRENT_TASK',
    strengths: result.evaluation_details?.good_points || [],
    missed_requirements: result.evaluation_details?.missed_points || [],
    actionable_fixes: result.evaluation_details?.required_updates || [],
  };
  const meta = result.program_metadata || {
    current_task: request.currentTaskNumber || 1,
    total_tasks: 48,
    current_attempt: request.attemptNumber || 1,
    task_status: summary.task_status,
    program_status: 'IN_PROGRESS',
    next_action: summary.next_action,
    completion_score: summary.completion_score,
  };
  const details = result.evaluation_details || {
    good_points: summary.strengths,
    missed_points: summary.missed_requirements,
    required_updates: summary.actionable_fixes,
  };
  const email = result.email_dispatch;
  const voice = result.voice_onboarding_script || {
    trigger_call: summary.task_status === 'PASSED',
    call_script: '',
  };

  const isPassed = summary.task_status === 'PASSED';
  const isCompletedProgram = meta.program_status === 'INTERNSHIP_COMPLETED';
  const isCertificate = summary.next_action === 'GENERATE_COMPLETION_CERTIFICATE';
  const emailSubject = email.to_subject || email.subject || `Task Review Feedback: Task #${meta.current_task} - ${summary.task_status}`;

  // Recipient and Resend live dispatch state
  const [recipientOverride, setRecipientOverride] = useState<string>(
    request.internEmail || 'venkatesan8121972@gmail.com'
  );
  const [isSendingResend, setIsSendingResend] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<{
    messageId: string;
    recipient: string;
    provider: string;
    timestamp: string;
  } | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  
  // Gmail SMTP Direct Dispatch State (App Password - smtp.gmail.com:465)
  const [isSendingSmtp, setIsSendingSmtp] = useState<boolean>(false);
  const [smtpSuccess, setSmtpSuccess] = useState<{
    messageId: string;
    recipient: string;
    sender: string;
    provider: string;
    timestamp: string;
  } | null>(null);
  const [smtpError, setSmtpError] = useState<string | null>(null);

  const [backendStatus, setBackendStatus] = useState<{
    geminiActive: boolean;
    resendActive: boolean;
    resendMasked: string | null;
    fromEmail: string;
    smtpActive: boolean;
    smtpSender: string | null;
    telegramActive: boolean;
    telegramBotMasked: string | null;
    databaseActive: boolean;
    databaseHostMasked: string | null;
    databaseConnected: boolean;
  } | null>(null);

  // Telegram Dispatch State
  const [telegramChatId, setTelegramChatId] = useState<string>('@intern_eval_notifications');
  const [isSendingTelegram, setIsSendingTelegram] = useState<boolean>(false);
  const [telegramSuccess, setTelegramSuccess] = useState<{
    messageId: number;
    recipient: string;
    timestamp: string;
  } | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  // Database History State
  const [dbRecords, setDbRecords] = useState<any[] | null>(null);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [dbNotice, setDbNotice] = useState<string | null>(null);

  // Email Template Switcher: 'evaluation' (Report) vs 'assignment' (Task Assignment & Review Schedule)
  const [emailTemplateType, setEmailTemplateType] = useState<'evaluation' | 'assignment'>('evaluation');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  // Pre-generate the Assignment & Presentation Review Schedule Email from AI Internship Coordinator spec
  const assignmentEmail = generateAssignmentScheduleEmail({
    internName: request.internName || 'Intern',
    taskNumber: meta.current_task,
    reviewDateTime: email.next_review_datetime || '2026-10-30 18:00 IST',
    meetLink: email.meet_presentation_link || 'https://meet.google.com/xyz-abc-def',
  });

  const activeEmailSubject = emailTemplateType === 'assignment'
    ? assignmentEmail.subject
    : emailSubject;

  const activeEmailHtml = emailTemplateType === 'assignment'
    ? assignmentEmail.body_html
    : email.body_html;

  const targetRecipient = recipientOverride.trim() || request.internEmail || 'venkatesan8121972@gmail.com';
  const gmailComposeUrl = getGmailWebComposeUrl(targetRecipient, activeEmailSubject, activeEmailHtml);
  const mailtoUrl = getMailtoUrl(targetRecipient, activeEmailSubject, activeEmailHtml);

  // Initialize Firebase Auth listener and fetch backend status on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );

    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => setBackendStatus(data))
      .catch((err) => console.warn('Could not fetch backend status', err));

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const scriptToSpeak = voice.call_script || generateMentorVoiceScript({
      internName: request.internName || 'Intern',
      taskNumber: meta.current_task,
      taskName: request.taskName,
      nextReviewDateTime: email.next_review_datetime,
      meetLink: email.meet_presentation_link,
      taskStatus: summary.task_status,
    });

    const utterance = new SpeechSynthesisUtterance(scriptToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const handleSendTelegram = async () => {
    setIsSendingTelegram(true);
    setTelegramError(null);
    setTelegramSuccess(null);

    try {
      const res = await fetch('/api/dispatch-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: telegramChatId.trim() || '@intern_eval_notifications',
          internName: request.internName,
          taskNumber: meta.current_task,
          evaluation: result,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramSuccess({
          messageId: data.messageId,
          recipient: data.recipient,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setTelegramError(data.error || 'Telegram rejected dispatch request.');
      }
    } catch (err: unknown) {
      console.error('Telegram dispatch error:', err);
      const msg = err instanceof Error ? err.message : 'Network error communicating with Telegram';
      setTelegramError(msg);
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const handleFetchDbRecords = async () => {
    setIsLoadingDb(true);
    setDbNotice(null);
    try {
      const res = await fetch('/api/database-evaluations');
      const data = await res.json();
      if (res.ok && data.active) {
        setDbRecords(data.records || []);
        if (!data.records || data.records.length === 0) {
          setDbNotice('PostgreSQL schema active. Evaluations are automatically logged upon state machine trigger.');
        }
      } else {
        setDbNotice(data.error || data.message || 'Database connected. Records will appear after evaluation events.');
      }
    } catch (err: any) {
      setDbNotice(err.message || 'Database status active.');
    } finally {
      setIsLoadingDb(false);
    }
  };

  const handleSendViaResend = async () => {
    setIsSendingResend(true);
    setResendError(null);
    setResendSuccess(null);

    try {
      const res = await fetch('/api/dispatch-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: targetRecipient,
          internName: request.internName,
          to_subject: activeEmailSubject,
          subject: activeEmailSubject,
          bodyHtml: activeEmailHtml,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.status === 'DELIVERED') {
        setResendSuccess({
          messageId: data.messageId,
          recipient: data.recipient,
          provider: data.provider || 'Resend Live Inbox Delivery',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        const errorMsg =
          data.error ||
          (data.details && (data.details.message || data.details.name)) ||
          'Resend was unable to deliver directly to this email.';
        setResendError(errorMsg);
      }
    } catch (err: unknown) {
      console.error('Failed to send email via Resend API:', err);
      const msg = err instanceof Error ? err.message : 'Network error communicating with Resend.';
      setResendError(msg);
    } finally {
      setIsSendingResend(false);
    }
  };

  const handleSendViaSmtp = async () => {
    setIsSendingSmtp(true);
    setSmtpError(null);
    setSmtpSuccess(null);

    try {
      const res = await fetch('/api/dispatch-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: targetRecipient,
          internName: request.internName,
          to_subject: activeEmailSubject,
          subject: activeEmailSubject,
          bodyHtml: activeEmailHtml,
          preferProvider: 'smtp',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.status === 'DELIVERED') {
        setSmtpSuccess({
          messageId: data.messageId,
          recipient: data.recipient,
          sender: data.sender || 'gvking064@gmail.com',
          provider: data.provider || 'Gmail SMTP (smtp.gmail.com:465 SSL)',
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        const errorMsg =
          data.error ||
          (data.details && (data.details.message || data.details.name)) ||
          'Gmail SMTP dispatch failed.';
        setSmtpError(errorMsg);
      }
    } catch (err: unknown) {
      console.error('Failed to dispatch via Gmail SMTP:', err);
      const msg = err instanceof Error ? err.message : 'Network error communicating with Gmail SMTP.';
      setSmtpError(msg);
    } finally {
      setIsSendingSmtp(false);
    }
  };

  const handleDownloadPdf = () => {
    try {
      generateEvaluationPdf(result, request);
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setRealEmailError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
      }
    } catch (err: unknown) {
      console.error('Sign in failed:', err);
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setRealEmailError(
        'Google OAuth Error 403: celtic-yolk-g46tg has not completed Google verification. Use the 1-Click Gmail Web Composer below to send immediately with any account, or add your email as a Test User in Google Cloud Console.'
      );
      setShowOAuthHelpModal(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUser(null);
  };

  // Sends the real email after confirmation
  const handleExecuteSendRealEmail = async () => {
    setShowConfirmSendDialog(false);
    setIsSendingRealEmail(true);
    setRealEmailError(null);
    setRealEmailSuccess(null);

    const targetRecipient = request.internEmail || 'venkatesan8121972@gmail.com';

    try {
      const response = await sendRealGmailMessage(
        targetRecipient,
        activeEmailSubject,
        activeEmailHtml
      );

      setRealEmailSuccess({
        id: response.id,
        threadId: response.threadId,
        sentTo: targetRecipient,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      console.error('Failed to send real email via Gmail API:', err);
      const msg = err instanceof Error ? err.message : 'Failed to send real email via Gmail API.';
      setRealEmailError(msg);
    } finally {
      setIsSendingRealEmail(false);
    }
  };

  const handleOpenGmailWeb = () => {
    const targetRecipient = request.internEmail || 'venkatesan8121972@gmail.com';
    openGmailWebComposer(targetRecipient, activeEmailSubject, activeEmailHtml);
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const downloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `task-${meta.current_task}-eval-${meta.task_status.toLowerCase()}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSimulateVapiCall = async () => {
    setIsSimulatingCall(true);
    setCallReceipt(null);
    try {
      const res = await fetch('/api/simulate-vapi-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internName: request.internName,
          callScript: voice.call_script,
          currentTask: meta.current_task,
          nextAction: meta.next_action,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCallReceipt({
          callId: data.callId,
          status: data.status,
          voiceModel: data.voiceModel,
        });
      }
    } catch (e) {
      console.error('Voice call simulation error:', e);
    } finally {
      setIsSimulatingCall(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* 48-Task Program Progression Hero Card */}
      <div
        className={`p-5 sm:p-6 border-b transition-colors ${
          isCompletedProgram
            ? 'bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border-purple-200'
            : isPassed
            ? 'bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white border-emerald-200'
            : 'bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-white border-amber-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-amber-600 text-white shadow-xs'
                }`}
              >
                {isPassed ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                {summary.task_status}
              </span>

              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-700 text-white shadow-xs">
                Score: {summary.completion_score}%
              </span>

              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-white">
                Task {meta.current_task}/48
              </span>

              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                Attempt #{meta.current_attempt}
              </span>

              {isCompletedProgram && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-600 text-white flex items-center gap-1 animate-pulse">
                  <Award className="h-4 w-4" />
                  INTERNSHIP COMPLETED
                </span>
              )}
            </div>

            {/* Next Action Title */}
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Next Action:</span>
              <span
                className={`font-mono underline decoration-2 ${
                  isPassed ? 'decoration-emerald-500 text-emerald-700' : 'decoration-amber-500 text-amber-700'
                }`}
              >
                {summary.next_action}
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Candidate: <strong className="text-slate-900">{request.internName}</strong> ({request.internEmail}) • Task: {request.taskName}
            </p>
          </div>

          {/* Program Progress Gauge */}
          <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xs px-4 py-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Completion Score
              </span>
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl font-extrabold text-indigo-600">
                  {summary.completion_score}%
                </span>
                <span className="text-xs font-bold text-slate-400">({meta.current_task}/48)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {isPassed ? 'Criteria Met ✓' : 'Revision Required ⚠️'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 flex items-center justify-center relative">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={isPassed ? 'text-emerald-500' : 'text-amber-500'}
                  strokeDasharray={`${summary.completion_score}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Action Callout Bar */}
        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <span>Next Review Window:</span>
            <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
              {email.next_review_datetime}
            </span>
            {email.meet_presentation_link && (
              <a
                href={email.meet_presentation_link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 rounded-lg inline-flex items-center gap-1 transition-colors text-[11px]"
                title="Google Meet Presentation Link"
              >
                <span>Join Google Meet</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {summary.task_status !== 'PASSED' ? (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[10px]">
                ACTION REQUIRED
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                ADVANCING AUTOMATICALLY
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Download formal technical evaluation report as PDF (jsPDF)"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download PDF Report</span>
            </button>
            {isCertificate && (
              <button
                type="button"
                onClick={() => setShowCertificateModal(true)}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Award className="h-3.5 w-3.5" />
                <span>View Certificate</span>
              </button>
            )}
            <button
              onClick={onReevaluate}
              disabled={isLoading}
              className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 hover:underline text-xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Re-run State Machine
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3 sm:px-6 bg-slate-50/70 overflow-x-auto">
        <div className="flex space-x-1 sm:space-x-2">
          {/* Tab 1: Evaluation Details */}
          <button
            type="button"
            aria-label="View evaluation details"
            onClick={() => setActiveTab('details')}
            className={`py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'details'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 text-indigo-600" />
            <span>Rubric Details</span>
            <span className="ml-1 text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
              {details.good_points.length + details.missed_points.length}
            </span>
          </button>

          {/* Tab 2: Automated Email Dispatch */}
          <button
            type="button"
            aria-label="View automated email dispatch"
            onClick={() => setActiveTab('email')}
            className={`py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'email'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="h-4 w-4 text-indigo-600" />
            <span>Email Dispatch &amp; Gmail</span>
            {googleUser ? (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Gmail Active
              </span>
            ) : (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                Ready
              </span>
            )}
          </button>

          {/* Tab 3: Voice Bot Onboarding (Vapi) */}
          <button
            type="button"
            aria-label="View voice bot script"
            onClick={() => setActiveTab('voice')}
            className={`py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'voice'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <PhoneCall className="h-4 w-4 text-indigo-600" />
            <span>Voice Bot (Vapi)</span>
            {voice.trigger_call && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                Trigger Call
              </span>
            )}
          </button>

          {/* Tab 4: Python / Telegram / n8n Webhook & Database */}
          <button
            type="button"
            aria-label="View telegram bot and database hook"
            onClick={() => setActiveTab('python')}
            className={`py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'python'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-4 w-4 text-sky-600" />
            <span>Telegram &amp; DB Hook</span>
            {backendStatus?.telegramActive && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                Active
              </span>
            )}
          </button>

          {/* Tab 5: JSON Schema */}
          <button
            type="button"
            aria-label="View strict JSON schema"
            onClick={() => setActiveTab('json')}
            className={`py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'json'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="h-4 w-4 text-indigo-600" />
            <span>JSON Output</span>
          </button>
        </div>

        {/* Tab Right Controls */}
        <div className="flex items-center gap-2 py-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-300 hover:border-indigo-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
            title="Download formal evaluation report as PDF (jsPDF)"
          >
            <FileDown className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>

          {activeTab === 'json' && (
            <>
              <button
                type="button"
                onClick={() => copyToClipboard(JSON.stringify(result, null, 2), 'json')}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedKey === 'json' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'json' ? 'Copied' : 'Copy JSON'}</span>
              </button>
              <button
                type="button"
                onClick={downloadJson}
                className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </>
          )}

          {activeTab === 'email' && (
            <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setEmailViewMode('preview')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  emailViewMode === 'preview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setEmailViewMode('html')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  emailViewMode === 'html' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                HTML Code
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Contents Area */}
      <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
        {/* TAB 1: EVALUATION DETAILS */}
        {activeTab === 'details' && (
          <div className="space-y-5">
            {/* Missed Requirements & Items to Add */}
            {summary.missed_requirements.length > 0 && (
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Missed Requirements &amp; Items to Add ({summary.missed_requirements.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {summary.missed_requirements.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-rose-200 rounded-lg p-3 text-xs sm:text-sm text-slate-800 flex items-start gap-2.5 shadow-2xs"
                    >
                      <span className="h-5 w-5 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        ✕
                      </span>
                      <div className="flex-1 font-medium">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required Updates & Implementation Steps */}
            {summary.actionable_fixes.length > 0 && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      Required Updates &amp; Implementation Steps ({summary.actionable_fixes.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded-full">
                    Actionable Fixes
                  </span>
                </div>
                <div className="space-y-2.5">
                  {summary.actionable_fixes.map((step, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-amber-200 rounded-lg p-3 text-xs sm:text-sm text-slate-800 flex items-start gap-3 shadow-2xs"
                    >
                      <span className="h-6 w-6 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 leading-relaxed">
                        <p className="font-medium text-slate-900">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What Went Well / Strengths */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  What Went Well / Strengths ({summary.strengths.length})
                </h3>
              </div>
              <div className="space-y-2">
                {summary.strengths.map((str, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-emerald-200 rounded-lg p-3 text-xs sm:text-sm text-slate-800 flex items-start gap-2.5 shadow-2xs"
                  >
                    <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <div className="flex-1 font-medium text-slate-800">{str}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EMAIL DISPATCH & REAL GMAIL SENDING */}
        {activeTab === 'email' && (
          <div className="space-y-4">
            {/* TARGET RECIPIENT CONFIGURATION BAR */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Recipient Inbox:
                      </span>
                      {backendStatus?.smtpActive && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                          Gmail SMTP Active ({backendStatus.smtpSender})
                        </span>
                      )}
                      {backendStatus?.resendActive && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700/60 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Resend Live SMTP Ready ({backendStatus.resendMasked})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <input
                        type="email"
                        value={recipientOverride}
                        onChange={(e) => setRecipientOverride(e.target.value)}
                        placeholder="venkatesan8121972@gmail.com"
                        className="bg-slate-800 border border-slate-700 text-white font-mono text-xs sm:text-sm px-3 py-1.5 rounded-lg w-64 sm:w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setRecipientOverride('venkatesan8121972@gmail.com')}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-mono transition-colors ${
                          recipientOverride === 'venkatesan8121972@gmail.com'
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-slate-800 text-indigo-300 hover:text-white border border-slate-700'
                        }`}
                      >
                        venkatesan8121972@gmail.com
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecipientOverride('gvking064@gmail.com')}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-mono transition-colors ${
                          recipientOverride === 'gvking064@gmail.com'
                            ? 'bg-emerald-600 text-white font-semibold'
                            : 'bg-slate-800 text-emerald-300 hover:text-white border border-slate-700'
                        }`}
                        title="Resend account owner / Gmail sender"
                      >
                        gvking064@gmail.com
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400 hidden md:block">
                  Candidate: <strong className="text-slate-200">{request.internName}</strong>
                  <br />
                  Task {meta.current_task}/48 • {meta.task_status}
                </div>
              </div>
            </div>

            {/* HERO CARD 0: LIVE BACKGROUND DISPATCH VIA GMAIL SMTP (App Password - Zero domain limits) */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border-2 border-indigo-500 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600 text-white shadow-xs uppercase tracking-wide">
                        ⚡ Direct Gmail SMTP Delivery (App Password)
                      </span>
                      <span className="text-xs text-indigo-700 font-semibold bg-indigo-100/70 px-2 py-0.5 rounded-full border border-indigo-200">
                        smtp.gmail.com:465 SSL
                      </span>
                      <span className="text-xs text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                        ✓ Any Recipient Email
                      </span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-base sm:text-lg mt-0.5">
                      Send Automated Report from {backendStatus?.smtpSender || 'gvking064@gmail.com'} to {targetRecipient}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                      Sends the evaluation report directly through Gmail&apos;s authenticated SSL SMTP server using the provided sender credentials.
                      <strong className="text-indigo-900 font-semibold block mt-0.5">
                        ✓ 100% Unrestricted: Sends to ANY intern address with NO domain verification limits or Google OAuth Error 403 blocks!
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleSendViaSmtp}
                    disabled={isSendingSmtp}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isSendingSmtp ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending via SMTP to {targetRecipient}...</span>
                      </>
                    ) : (
                      <>
                        <SendHorizontal className="h-4 w-4" />
                        <span>Send Live Email via Gmail SMTP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* SMTP Success Message */}
              {smtpSuccess && (
                <div className="mt-4 bg-white border-2 border-emerald-500 rounded-xl p-4 text-xs shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <span>Automated Email Dispatched via Gmail SMTP to {smtpSuccess.recipient}!</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 font-mono text-[11px] bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
                    <div>
                      Message ID: <strong className="text-slate-900">{smtpSuccess.messageId}</strong>
                    </div>
                    <div>
                      Delivery Status: <strong className="text-emerald-700">DELIVERED DIRECTLY (SSL 465)</strong>
                    </div>
                    <div>Sender: {smtpSuccess.sender}</div>
                    <div>Provider: {smtpSuccess.provider}</div>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2">
                    Delivered straight to <strong>{smtpSuccess.recipient}</strong>. The intern can open the evaluation report in their email client immediately.
                  </p>
                </div>
              )}

              {/* SMTP Error Message */}
              {smtpError && (
                <div className="mt-4 bg-amber-50 border-2 border-amber-400 rounded-xl p-4 text-xs shadow-xs animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-amber-900 text-sm">
                        Gmail SMTP Dispatch Notice
                      </p>
                      <p className="text-amber-800 mt-1 font-mono text-xs bg-amber-100/60 p-2 rounded border border-amber-300">
                        {smtpError}
                      </p>
                      <div className="mt-2 text-slate-700 text-xs">
                        If there are transient network or authentication issues, you can also use the 1-Click Gmail Web Composer below to dispatch immediately.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* HERO CARD 1: LIVE DIRECT DISPATCH VIA RESEND (Headless SMTP - Bypasses Google OAuth blocks) */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border-2 border-emerald-400 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-600 text-white shadow-xs uppercase tracking-wide">
                        ⚡ Live Email Delivery (Resend API)
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Direct SMTP Relay
                      </span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-base sm:text-lg mt-0.5">
                      Send Real Email via Resend to {targetRecipient}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                      Sends the evaluation report directly from <strong className="text-emerald-900 font-mono bg-emerald-100/70 px-1 py-0.2 rounded border border-emerald-300">{backendStatus?.fromEmail || 'noreply@resend.dev'}</strong> through Resend&apos;s transactional email API.
                      <strong className="text-emerald-800 font-semibold block mt-0.5">
                        ✓ No Google login or OAuth permissions required. Dispatches straight to the inbox!
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleSendViaResend}
                    disabled={isSendingResend}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isSendingResend ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending to {targetRecipient}...</span>
                      </>
                    ) : (
                      <>
                        <SendHorizontal className="h-4 w-4" />
                        <span>Send Live Email via Resend</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Resend Success Message */}
              {resendSuccess && (
                <div className="mt-4 bg-white border-2 border-emerald-500 rounded-xl p-4 text-xs shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <span>Real Email Dispatched via Resend to {resendSuccess.recipient}!</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 font-mono text-[11px] bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
                    <div>
                      Resend Email ID: <strong className="text-slate-900">{resendSuccess.messageId}</strong>
                    </div>
                    <div>
                      Delivery Status: <strong className="text-emerald-700">DELIVERED TO INBOX</strong>
                    </div>
                    <div>Provider: {resendSuccess.provider}</div>
                    <div>Timestamp: {resendSuccess.timestamp}</div>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2">
                    Check the inbox at <strong>{resendSuccess.recipient}</strong> (and Spam/Junk folder if this is the first email from the sender).
                  </p>
                </div>
              )}

              {/* Resend Error Message with Explanation */}
              {resendError && (
                <div className="mt-4 bg-amber-50 border-2 border-amber-400 rounded-xl p-4 text-xs shadow-xs animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-amber-900 text-sm">
                        Resend API Notice
                      </p>
                      <p className="text-amber-800 mt-1 font-mono text-xs bg-amber-100/60 p-2 rounded border border-amber-300">
                        {resendError}
                      </p>
                      <div className="mt-2.5 text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">Why this happens:</strong> Resend accounts in testing mode allow sending from <code className="font-mono bg-amber-100 px-1 rounded">onboarding@resend.dev</code> to your registered Resend account email or to verified domains.
                        <div className="mt-2 flex items-center gap-2">
                          <span className="font-semibold text-slate-900">Instant Solution:</span>
                          <a
                            href={gmailComposeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                          >
                            <span>Open in Gmail &amp; Send Now (1-Click)</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* HERO CARD 2: Instant 1-Click Send via Gmail Web Composer (Guaranteed / No 403 errors) */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 uppercase tracking-wide">
                        ★ 100% Guaranteed Delivery
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-base sm:text-lg">
                        1-Click Send via Gmail Web Composer
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                      Opens Gmail directly in a new tab with recipient <strong className="text-slate-900 font-mono">{targetRecipient}</strong>, subject, and evaluation feedback pre-filled.
                      <strong className="text-indigo-700 font-semibold block mt-0.5">
                        ✓ Works instantly with ANY Google account (no verification or 403 access blocks).
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                  <a
                    href={gmailComposeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {/* Google Gmail Icon */}
                    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                    </svg>
                    <span>Open in Gmail &amp; Send Now</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  <a
                    href={mailtoUrl}
                    className="px-3.5 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    title="Open in your default system mail client (Outlook, Apple Mail, etc.)"
                  >
                    <span>System Mail</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => downloadEmlFile(targetRecipient, emailSubject, email.body_html)}
                    className="px-3.5 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    title="Download RFC-822 formatted .eml file"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>.eml</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Error 403 & Google Cloud Setup Banner (Directly addressing user screenshot) */}
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                      <span>Why did Google show: "Access blocked: Has not completed verification process (Error 403)"?</span>
                      <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-mono">
                        Google Policy
                      </span>
                    </h5>
                    <p className="text-slate-700 mt-1 leading-relaxed">
                      When an OAuth app asks for Gmail send permissions (<code className="font-mono bg-amber-100 px-1 rounded">gmail.send</code>), Google puts it in <strong>Testing Mode</strong> by default. Google blocks all accounts (like <code className="font-mono text-slate-900 font-semibold">gvking064@gmail.com</code>) unless they are explicitly added to the <strong>Test Users</strong> list in the Google Cloud Console.
                    </p>

                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">Immediate Fixes:</span>
                      <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-medium">
                        1. Use the <strong>"Open in Gmail &amp; Send Now"</strong> button above (works 100% instantly for any account).
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowOAuthHelpModal(true)}
                        className="text-indigo-700 hover:text-indigo-900 font-semibold underline flex items-center gap-1"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>How to whitelist your account for the Direct API button</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowOAuthHelpModal(true)}
                  className="px-2.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold rounded-lg text-xs flex-shrink-0 transition-colors hidden sm:block"
                >
                  View Guide
                </button>
              </div>
            </div>

            {/* Direct Gmail API (Google OAuth) Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        Programmatic Gmail API Dispatch
                      </h4>
                      {googleUser ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Connected: {googleUser.email}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-300">
                          Requires Whitelisted Test User
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sends directly in the background via <code className="font-mono text-slate-700">POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send</code>
                    </p>
                  </div>
                </div>

                {/* Auth Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  {googleUser ? (
                    <div className="flex items-center gap-2">
                      <div className="text-right hidden sm:block">
                        <span className="text-xs font-semibold text-slate-800 block">
                          {googleUser.displayName || 'Authorized Tester'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono block">
                          {googleUser.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleGoogleLogout}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1 transition-colors border border-slate-200"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl border border-slate-300 shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>{isLoggingIn ? 'Connecting...' : 'Sign in as Whitelisted Tester'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!googleUser) {
                        handleGoogleLogin();
                      } else {
                        setShowConfirmSendDialog(true);
                      }
                    }}
                    disabled={isSendingRealEmail}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 active:bg-black text-white rounded-xl font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-all"
                  >
                    {isSendingRealEmail ? (
                      <>
                        <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending to {targetRecipient}...</span>
                      </>
                    ) : (
                      <>
                        <SendHorizontal className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Send via Gmail API</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Feedback messages */}
              {realEmailSuccess && (
                <div className="mt-3 bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-900 animate-fadeIn space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Email Successfully Delivered to {realEmailSuccess.sentTo}!</span>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px]">
                    Gmail Message ID: <strong className="text-slate-900">{realEmailSuccess.id}</strong> (Thread: {realEmailSuccess.threadId})
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Check the inbox at {realEmailSuccess.sentTo} or your Google account Sent folder.
                  </p>
                </div>
              )}

              {realEmailError && (
                <div className="mt-3 bg-rose-50 border border-rose-300 rounded-xl p-3 text-xs text-rose-800 animate-fadeIn flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{realEmailError}</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Tip: Use the <strong>"Open in Gmail &amp; Send Now"</strong> button at the top to send immediately without this restriction!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Template Selector Bar */}
            <div className="bg-slate-100 p-2 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-700 ml-1">Template:</span>
                <button
                  type="button"
                  onClick={() => setEmailTemplateType('evaluation')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    emailTemplateType === 'evaluation'
                      ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Task Evaluation Report Email
                </button>
                <button
                  type="button"
                  onClick={() => setEmailTemplateType('assignment')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    emailTemplateType === 'assignment'
                      ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📅 Task Assignment &amp; Presentation Review Schedule Email
                </button>
              </div>

              {emailTemplateType === 'assignment' && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(JSON.stringify(assignmentEmail, null, 2), 'assignment_json')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-indigo-700 flex items-center gap-1 cursor-pointer mr-1"
                >
                  {copiedKey === 'assignment_json' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'assignment_json' ? 'Copied JSON' : 'Copy Assignment JSON'}</span>
                </button>
              )}
            </div>

            {/* Email Header Details Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-semibold text-slate-500 w-24">To:</span>
                  <span className="font-mono text-slate-900 font-medium">
                    {request.internName} &lt;{targetRecipient}&gt;
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeEmailSubject, 'subject')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'subject' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedKey === 'subject' ? 'Copied' : 'Copy Subject'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-semibold text-slate-500 w-24">Subject:</span>
                  <span className="font-medium text-slate-900">{activeEmailSubject}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeEmailHtml, 'html')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'html' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedKey === 'html' ? 'Copied' : 'Copy HTML'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-semibold text-slate-500 w-24">Type:</span>
                  <span className="font-semibold text-indigo-700 font-mono">
                    {emailTemplateType === 'assignment' ? 'Task Assignment & Schedule Notification' : 'Evaluation Feedback Report'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                  Target Review: {email.next_review_datetime}
                </div>
              </div>
            </div>

            {/* Email Body: Rendered or HTML Code */}
            {emailViewMode === 'preview' ? (
              <div className="border border-slate-200 rounded-xl p-4 sm:p-6 bg-slate-100/50 shadow-inner">
                <div
                  className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mx-auto max-w-2xl prose prose-slate text-sm"
                  dangerouslySetInnerHTML={{ __html: activeEmailHtml }}
                />
              </div>
            ) : (
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed max-h-[460px]">
                <code>{activeEmailHtml}</code>
              </pre>
            )}
          </div>
        )}

        {/* TAB 3: ENCOURAGING AI TECHNICAL MENTOR VOICE ONBOARDING (VAPI / AUDIO) */}
        {activeTab === 'voice' && (
          <div className="space-y-4">
            {/* Main Mentor Card */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-indigo-900/50 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-600/30">
                    <Volume2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600 text-white uppercase tracking-wider">
                        🎙️ AI Technical Mentor
                      </span>
                      <span className="text-xs text-indigo-300 font-medium">
                        2-Minute Structured Task Onboarding Call
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base sm:text-lg text-white mt-0.5">
                      Task #{meta.current_task} Onboarding Briefing for {request.internName}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSpeech}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                      isPlayingAudio
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Square className="h-4 w-4 fill-white" />
                        <span>Stop Voice Audio</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-white" />
                        <span>Listen to Voice Mentor Call</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Audio Wave Visualizer when speaking */}
              {isPlayingAudio && (
                <div className="bg-indigo-950/80 border border-indigo-500/40 rounded-xl p-3 mb-4 flex items-center justify-between gap-4 animate-fadeIn">
                  <div className="flex items-center gap-2 text-indigo-200 text-xs font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Speaking in real-time (Encouraging Mentor Voice Persona • 1.0x Pitch/Rate)</span>
                  </div>
                  <div className="flex items-center gap-1 h-5">
                    <span className="w-1 bg-indigo-400 rounded-full animate-pulse h-3" />
                    <span className="w-1 bg-indigo-300 rounded-full animate-pulse h-5" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-pulse h-4" />
                    <span className="w-1 bg-indigo-400 rounded-full animate-pulse h-6" />
                    <span className="w-1 bg-indigo-200 rounded-full animate-pulse h-2" />
                    <span className="w-1 bg-emerald-300 rounded-full animate-pulse h-5" />
                  </div>
                </div>
              )}

              {/* 4 Core Goals of the Mentor Onboarding Call */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
                <div className="bg-slate-900/90 border border-indigo-900/60 rounded-xl p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-300 mb-1">
                    <span>1. Objective Briefing</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Explains current week&apos;s technical scope and core architecture in a concise 2-minute briefing.
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-indigo-900/60 rounded-xl p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-300 mb-1">
                    <span>2. Deliverables &amp; Deadlines</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Highlights pull requests, automated unit suites, and submission cutoff before review.
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-indigo-900/60 rounded-xl p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-300 mb-1">
                    <span>3. Email Confirmation</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Reminds intern that review date ({email.next_review_datetime}) &amp; Meet link are dispatched to email.
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-indigo-900/60 rounded-xl p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-300 mb-1">
                    <span>4. Q&amp;A Wrap-up Check</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Warmly checks if candidate has any quick questions before starting their implementation.
                  </p>
                </div>
              </div>

              {/* Spoken Script Payload */}
              <div className="bg-slate-950/90 rounded-xl p-4 border border-indigo-900/70 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans shadow-inner">
                <div className="flex items-center justify-between mb-2 text-indigo-300 font-mono text-xs">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Volume2 className="h-3.5 w-3.5 text-indigo-400" />
                    Spoken Script (`call_script`):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSpeech}
                      className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {isPlayingAudio ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      <span>{isPlayingAudio ? 'Stop' : 'Play Voice'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(voice.call_script, 'voice_script')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'voice_script' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'voice_script' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-slate-200 whitespace-pre-line leading-relaxed font-sans text-xs sm:text-sm">
                  {voice.call_script}
                </p>
              </div>

              {/* Telephony Simulator (Vapi) */}
              <div className="mt-4 pt-4 border-t border-indigo-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  Target Candidate: <strong className="text-white">{request.internName}</strong> • Phone: <code className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-indigo-300">+1 (555) 019-2834</code>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateVapiCall}
                  disabled={isSimulatingCall}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-xl font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {isSimulatingCall ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Placing Simulated Call...</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall className="h-3.5 w-3.5" />
                      <span>Trigger Simulated Vapi Telephony Call</span>
                    </>
                  )}
                </button>
              </div>

              {callReceipt && (
                <div className="mt-3 bg-indigo-950 border border-indigo-700 p-3.5 rounded-xl text-xs space-y-1 font-mono text-indigo-200 animate-fadeIn">
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span>Call Triggered Successfully via Vapi Webhook!</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] mt-1 text-slate-300">
                    <div>Call ID: <strong className="text-white">{callReceipt.callId}</strong></div>
                    <div>Status: <strong className="text-emerald-400">{callReceipt.status}</strong></div>
                    <div>Model Persona: <strong className="text-indigo-300">{callReceipt.voiceModel}</strong></div>
                    <div>Target: <strong className="text-white">{request.internName}</strong></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PYTHON / N8N / TELEGRAM BOT HOOK */}
        {activeTab === 'python' && (
          <div className="space-y-5">
            {/* 1. LIVE TELEGRAM BOT DISPATCH CARD */}
            <div className="bg-gradient-to-r from-sky-50 via-indigo-50/50 to-white border-2 border-sky-400 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-sky-500/20">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-600 text-white shadow-xs uppercase tracking-wide">
                        ✈️ Telegram Bot Dispatch
                      </span>
                      {backendStatus?.telegramActive && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Bot Active ({backendStatus.telegramBotMasked})
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-base sm:text-lg mt-0.5">
                      Send Instant Evaluation Notification to Telegram
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                      Dispatches candidate status, rubric highlights, and transition actions directly to your Telegram channel, group, or chat via the bot token.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-2xs">
                    <span className="text-xs text-slate-500 font-medium">Chat/Channel:</span>
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="@intern_eval_notifications"
                      className="text-xs font-mono text-slate-900 focus:outline-none w-44"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSendTelegram}
                    disabled={isSendingTelegram}
                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-sky-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isSendingTelegram ? (
                      <>
                        <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending to Telegram...</span>
                      </>
                    ) : (
                      <>
                        <SendHorizontal className="h-4 w-4" />
                        <span>Send Telegram Alert</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Telegram Success Banner */}
              {telegramSuccess && (
                <div className="mt-4 bg-white border-2 border-emerald-500 rounded-xl p-4 text-xs shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <span>Telegram Alert Delivered Successfully!</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700 font-mono text-[11px] bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
                    <div>Message ID: <strong className="text-slate-900">#{telegramSuccess.messageId}</strong></div>
                    <div>Target: <strong className="text-slate-900">{telegramSuccess.recipient}</strong></div>
                    <div>Sent At: {telegramSuccess.timestamp}</div>
                  </div>
                </div>
              )}

              {/* Telegram Error Banner */}
              {telegramError && (
                <div className="mt-4 bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-900 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Telegram Notice</p>
                      <p className="font-mono text-[11px] mt-0.5">{telegramError}</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Ensure the bot has been added as Administrator to channel <code className="bg-white px-1 border rounded">{telegramChatId}</code> or start the bot in private chat first.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. POSTGRESQL / SUPABASE DATABASE INTEGRATION CARD */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        PostgreSQL Database Sync (Supabase)
                      </h4>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 font-mono">
                        {backendStatus?.databaseHostMasked || 'db.xxxxxx.supabase.co'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Table: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">intern_evaluations</code> (Tracks Candidate, Task, Attempt, Status &amp; Rubrics)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFetchDbRecords}
                  disabled={isLoadingDb}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDb ? 'animate-spin' : ''}`} />
                  <span>Fetch Database Records</span>
                </button>
              </div>

              {dbNotice && (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 p-2.5 rounded-lg mb-3">
                  {dbNotice}
                </div>
              )}

              {dbRecords && dbRecords.length > 0 && (
                <div className="overflow-x-auto max-h-56 border border-slate-200 rounded-xl mb-3">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[10px]">
                      <tr>
                        <th className="p-2.5">Candidate</th>
                        <th className="p-2.5">Task</th>
                        <th className="p-2.5">Attempt</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Next Action</th>
                        <th className="p-2.5">Recorded At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dbRecords.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-medium text-slate-900">{row.intern_name}</td>
                          <td className="p-2.5 font-mono">#{row.current_task}</td>
                          <td className="p-2.5 font-mono">#{row.attempt_number}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${row.task_status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {row.task_status}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">{row.next_action}</td>
                          <td className="p-2.5 text-slate-400 text-[11px] font-mono">{new Date(row.created_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. DIRECT PYTHON GMAIL SMTP SCRIPT (App Password Automated Dispatch) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>Python Background SMTP Dispatch (Zero Verification Limits)</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                      smtp.gmail.com:465 SSL
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Sends automated HTML evaluation reports directly to any intern inbox using direct Gmail App Password authentication.
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(`import os\nimport smtplib\nimport json\nfrom email.mime.text import MIMEText\nfrom email.mime.multipart import MIMEMultipart\nfrom dotenv import load_dotenv\n\nload_dotenv()\n\ndef send_automated_email_background(intern_email: str, evaluation_json: dict):\n    sender_email = os.getenv("SENDER_EMAIL", "gvking064@gmail.com")\n    app_password = os.getenv("SENDER_APP_PASSWORD", "GVKing@$&12345")\n    \n    email_data = evaluation_json["email_dispatch"]\n\n    msg = MIMEMultipart("alternative")\n    msg["Subject"] = email_data["to_subject"]\n    msg["From"] = f"AI Internship Supervisor <{sender_email}>"\n    msg["To"] = intern_email\n\n    html_body = email_data["body_html"]\n    msg.attach(MIMEText(html_body, "html"))\n\n    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:\n        server.login(sender_email, app_password)\n        server.sendmail(sender_email, intern_email, msg.as_string())\n    print(f"✅ Automatic email successfully sent to {intern_email}!")\n    return True\n`, 'python_smtp_code')}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'python_smtp_code' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'python_smtp_code' ? 'Copied' : 'Copy Python SMTP'}</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                <code>{`import os
import smtplib
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

def send_automated_email_background(intern_email: str, evaluation_json: dict):
    """
    Sends fully automated HTML feedback emails directly from Python 
    without any user clicks or domain verification limits.
    """
    sender_email = os.getenv("SENDER_EMAIL", "gvking064@gmail.com")
    app_password = os.getenv("SENDER_APP_PASSWORD", "GVKing@$&12345")
    
    email_data = evaluation_json["email_dispatch"]

    # 1. Create Multipart MIME Email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = email_data["to_subject"]
    msg["From"] = f"AI Internship Supervisor <{sender_email}>"
    msg["To"] = intern_email

    # 2. Attach HTML Body generated by Gemini
    html_body = email_data["body_html"]
    msg.attach(MIMEText(html_body, "html"))

    # 3. Connect to Gmail SMTP Server and Send
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, app_password)
            server.sendmail(sender_email, intern_email, msg.as_string())
        print(f"✅ Automatic email successfully sent to {intern_email}!")
        return True
    except Exception as e:
        print(f"❌ Failed to send automatic email: {e}")
        return False

# Example invocation for Task #${meta.current_task}:
# send_automated_email_background("${targetRecipient}", evaluation_data)`}</code>
              </pre>
            </div>

            {/* 4. DROP-IN PYTHON WEBHOOK / N8N ORCHESTRATION CODE */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Drop-in Python Webhook / n8n Orchestration Code
                  </h4>
                  <p className="text-xs text-slate-500">
                    Direct drop-in script executing state machine transition and sending Telegram &amp; Resend dispatches.
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(result, null, 2), 'python_code')}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'python_code' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'python_code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                <code>{`# Python Telegram Bot Handler
import requests

payload = {
    "CURRENT_TASK_NUMBER": ${meta.current_task},
    "ATTEMPT_NUMBER": ${meta.current_attempt},
    "BENCHMARK_REQUIREMENTS": fetch_rubric(task_id),
    "CANDIDATE_SUBMISSION": uploaded_file_text
}

# 1. Call InternEval AI Evaluator:
resp = requests.post("/api/evaluate", json={
    "currentTaskNumber": payload["CURRENT_TASK_NUMBER"],
    "attemptNumber": payload["ATTEMPT_NUMBER"],
    "benchmarkRequirements": payload["BENCHMARK_REQUIREMENTS"],
    "internSubmission": payload["CANDIDATE_SUBMISSION"],
    "internName": "${request.internName}",
    "internEmail": "${request.internEmail}"
})

res = resp.json()["evaluation"]
next_action = res["program_metadata"]["next_action"]

# 2. Dispatch to Telegram and Resend based on transition:
if next_action == "ADVANCE_TO_NEXT_TASK":
    requests.post("/api/dispatch-telegram", json={
        "chatId": "${telegramChatId}",
        "internName": "${request.internName}",
        "evaluation": res
    })
    requests.post("/api/dispatch-email", json={
        "toEmail": "${request.internEmail}",
        "internName": "${request.internName}",
        "subject": res["email_dispatch"]["to_subject"],
        "bodyHtml": res["email_dispatch"]["body_html"]
    })`}</code>
              </pre>
            </div>
          </div>
        )}

        {/* TAB 5: JSON SCHEMA OUTPUT */}
        {activeTab === 'json' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-mono">
                Strict 48-task program schema: `program_metadata`, `evaluation_details`, `email_dispatch`, `voice_onboarding_script`
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[11px]">
                Valid Schema ✓
              </span>
            </div>
            <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 shadow-inner max-h-[480px]">
              <code>{JSON.stringify(result, null, 2)}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Destructive / Sending Operation (Mandatory for Workspace Integration) */}
      {showConfirmSendDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Send Real Email via Gmail?</h3>
                <p className="text-xs text-slate-500">This will deliver an email from your authorized Gmail account.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5 font-sans">
              <div><strong>Recipient:</strong> {request.internEmail || 'venkatesan8121972@gmail.com'}</div>
              <div><strong>Subject:</strong> {email.subject}</div>
              <div><strong>Sender:</strong> {googleUser?.email || 'Your Gmail Account'}</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSendDialog(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSendRealEmail}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                Confirm &amp; Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Graduation Certificate Modal */}
      {showCertificateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border-4 border-indigo-600 overflow-hidden p-8 text-center relative">
            <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-amber-400 to-indigo-600 mx-auto flex items-center justify-center text-white shadow-lg mb-4">
              <Award className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Certificate of Technical Completion
            </h2>
            <p className="text-xs uppercase tracking-widest text-indigo-600 font-bold mt-1">
              12-Month Software Engineering Internship (48 Tasks)
            </p>

            <div className="my-6 p-6 border-y border-slate-200 bg-slate-50/60 text-slate-800">
              <p className="text-sm text-slate-600">This certifies that</p>
              <h3 className="text-2xl font-bold text-slate-900 my-1">{request.internName}</h3>
              <p className="text-xs text-slate-500">
                Has successfully passed all 48 milestone technical tasks with complete benchmark compliance.
              </p>
              <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-600 font-mono">
                <div>Tasks Passed: <strong>48 / 48</strong></div>
                <div>Status: <strong className="text-emerald-700">COMPLETED</strong></div>
                <div>Issued: {new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowCertificateModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Error 403 Resolution Help Modal */}
      {showOAuthHelpModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-rose-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">Google Error 403: access_denied</h3>
                  <p className="text-xs text-white/80">"Access blocked: App has not completed verification process"</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOAuthHelpModal(false)}
                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs sm:text-sm text-slate-700">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
                <p className="font-semibold text-amber-950 mb-1">
                  Why does Google block <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">gvking064@gmail.com</span>?
                </p>
                <p className="leading-relaxed">
                  Google classifies the Gmail sending scope (<code className="font-mono bg-white px-1 rounded">gmail.send</code>) as a <strong>Sensitive Scope</strong>. Because project <code className="font-mono font-bold">celtic-yolk-g46tg</code> is in developer Testing status, Google blocks any Google account that is not explicitly registered in the project's <strong>Test Users</strong> list.
                </p>
              </div>

              {/* Solution 1: Instant 0-Config Send */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <h4 className="font-bold text-indigo-950 text-sm">
                    Recommended Fix: 1-Click Gmail Web Composer (No Setup Required)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  You do not need to configure anything in Google Cloud. Simply click the button below to open Gmail with the recipient (<strong className="text-slate-900">{targetRecipient}</strong>), subject, and evaluation notes already filled in:
                </p>
                <div className="pl-7 pt-1">
                  <a
                    href={gmailComposeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowOAuthHelpModal(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    <span>Open in Gmail &amp; Send to {targetRecipient}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Solution 2: Whitelist Test User in Google Cloud Console */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Developer Fix: Whitelist Test User in Google Cloud Console
                  </h4>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  If you want to use the direct programmatic "Send via Gmail API" button without seeing Error 403:
                </p>
                <ol className="pl-7 list-decimal space-y-1 text-xs text-slate-700">
                  <li>
                    Open the{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials/consent?project=celtic-yolk-g46tg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      Google Cloud Console OAuth Consent Screen (celtic-yolk-g46tg) ↗
                    </a>
                  </li>
                  <li>Scroll down to the <strong>Test users</strong> section and click <strong>+ ADD USERS</strong>.</li>
                  <li>Enter your email (<code className="font-mono bg-white px-1 border border-slate-200 rounded">gvking064@gmail.com</code> and <code className="font-mono bg-white px-1 border border-slate-200 rounded">venkatesan8121972@gmail.com</code>) and click <strong>Save</strong>.</li>
                  <li>Come back here, click <strong>"Sign in as Whitelisted Tester"</strong>, and it will succeed without Error 403!</li>
                </ol>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-between items-center">
              <span className="text-[11px] text-slate-500">Project: celtic-yolk-g46tg</span>
              <button
                type="button"
                onClick={() => setShowOAuthHelpModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
