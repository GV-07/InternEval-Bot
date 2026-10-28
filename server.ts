import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { EvaluationRequest } from './src/types/evaluator.js';
import {
  validateWorkflowEvaluationResult,
  enforceWorkflowTransitionRules,
  generateDeterministicWorkflowEvaluation,
} from './src/utils/evaluator-rules.js';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI client
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (ai) return ai;
  const key = process.env.GEMINI_API_KEY;
  if (key && key !== 'MY_GEMINI_API_KEY' && key.trim().length > 0) {
    ai = new GoogleGenAI({
      apiKey: key.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    return ai;
  }
  return null;
}

// PostgreSQL / Supabase Database Connection Pool
let dbPool: pg.Pool | null = null;
let dbConnected = false;
let dbHostMasked: string | null = null;

function getDbPool(): pg.Pool | null {
  if (dbPool) return dbPool;
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl && dbUrl.startsWith('postgres')) {
    try {
      const parsedUrl = new URL(dbUrl);
      dbHostMasked = parsedUrl.host;
      if (parsedUrl.hostname.includes('xxxxxx')) {
        return null;
      }
      dbPool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 2000,
        idleTimeoutMillis: 5000,
      });

      // Non-blocking initialization of table schema
      dbPool.query(`
        CREATE TABLE IF NOT EXISTS intern_evaluations (
          id SERIAL PRIMARY KEY,
          intern_name VARCHAR(255),
          intern_email VARCHAR(255),
          current_task INTEGER,
          attempt_number INTEGER,
          task_status VARCHAR(50),
          program_status VARCHAR(50),
          next_action VARCHAR(100),
          good_points JSONB,
          missed_points JSONB,
          required_updates JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `).then(() => {
        dbConnected = true;
        console.log(`[Database] PostgreSQL / Supabase schema active at ${dbHostMasked}`);
      }).catch((err) => {
        console.warn(`[Database] PostgreSQL notice: ${err.message}`);
      });

      return dbPool;
    } catch (e: any) {
      console.warn(`[Database] Failed to configure DATABASE_URL:`, e.message);
    }
  }
  return null;
}

// Background helper to record evaluations into PostgreSQL
async function saveEvaluationToDb(evalResult: any, reqData: any) {
  try {
    const pool = getDbPool();
    if (!pool) return;
    const meta = evalResult.program_metadata;
    const details = evalResult.evaluation_details;
    await pool.query(
      `INSERT INTO intern_evaluations 
        (intern_name, intern_email, current_task, attempt_number, task_status, program_status, next_action, good_points, missed_points, required_updates)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        reqData.internName || 'Intern',
        reqData.internEmail || 'intern@example.com',
        meta.current_task,
        meta.current_attempt,
        meta.task_status,
        meta.program_status,
        meta.next_action,
        JSON.stringify(details.good_points || []),
        JSON.stringify(details.missed_points || []),
        JSON.stringify(details.required_updates || []),
      ]
    );
    dbConnected = true;
  } catch (err: any) {
    console.warn(`[Database] Optional DB record save notice:`, err.message);
  }
}

// Initialize DB pool on startup in background
try {
  getDbPool();
} catch {
  // ignore startup DB connection hiccups
}

function getMaskedTelegramToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  if (token.length > 8) {
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
  }
  return 'configured';
}

// GET /api/status - Returns active backend integrations (without leaking keys)
app.get('/api/status', (_req: Request, res: Response) => {
  const gemini = !!getGeminiClient();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.FROM_EMAIL?.trim() || 'noreply@resend.dev';
  const tgToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const dbUrl = process.env.DATABASE_URL?.trim();

  let host = dbHostMasked;
  if (!host && dbUrl) {
    try {
      const u = new URL(dbUrl);
      host = u.host;
    } catch {
      host = 'PostgreSQL/Supabase configured';
    }
  }

  const smtpUser = process.env.SENDER_EMAIL?.trim();
  const smtpPass = process.env.SENDER_APP_PASSWORD?.trim();

  res.json({
    geminiActive: gemini,
    resendActive: !!(resendKey && resendKey.startsWith('re_')),
    resendMasked: resendKey && resendKey.startsWith('re_') ? `${resendKey.slice(0, 6)}...${resendKey.slice(-4)}` : null,
    fromEmail,
    smtpActive: !!(smtpUser && smtpPass),
    smtpSender: smtpUser || null,
    telegramActive: !!(tgToken && tgToken.length > 5),
    telegramBotMasked: getMaskedTelegramToken(),
    databaseActive: !!dbUrl,
    databaseHostMasked: host,
    databaseConnected: dbConnected,
  });
});

// GET /api/telegram-bot-info - Verifies Telegram bot credentials
app.get('/api/telegram-bot-info', async (_req: Request, res: Response): Promise<void> => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    res.status(400).json({ active: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' });
    return;
  }
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const tgData = await tgRes.json();
    if (tgData.ok) {
      res.json({ active: true, bot: tgData.result });
    } else {
      res.json({ active: false, error: tgData.description || 'Invalid Telegram bot credentials' });
    }
  } catch (e: any) {
    res.status(502).json({ active: false, error: e.message || 'Network error reaching Telegram API' });
  }
});

// POST /api/dispatch-telegram - Dispatches notification to a Telegram Chat or Channel
app.post('/api/dispatch-telegram', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      res.status(400).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' });
      return;
    }

    const { chatId, customText, internName, taskNumber, evaluation } = req.body;
    const targetChat = chatId || '@intern_eval_notifications';

    let messageText = customText;
    if (!messageText && evaluation) {
      const meta = evaluation.program_metadata;
      const details = evaluation.evaluation_details;
      const statusIcon = meta.task_status === 'PASSED' ? '✅' : '⚠️';

      messageText = `*InternEval AI — Task #${meta.current_task} Evaluation*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Candidate:* ${internName || 'Intern'}\n` +
        `📌 *Milestone:* Task ${meta.current_task} of 48 (Attempt #${meta.current_attempt})\n` +
        `🎯 *Status:* ${statusIcon} *${meta.task_status}*\n` +
        `⚡ *Next Action:* \`${meta.next_action}\`\n\n` +
        `*Rubric Highlights:*\n` +
        (details?.good_points?.slice(0, 3).map((g: string) => `• ✓ ${g}`).join('\n') || 'None') +
        (meta.task_status !== 'PASSED' && details?.required_updates?.length ? `\n\n*Required Updates:*\n` + details.required_updates.slice(0, 3).map((u: string) => `• ⚠️ ${u}`).join('\n') : '') +
        `\n\n📅 *Review Schedule:* ${evaluation.email_dispatch?.next_review_datetime || 'Next Sprint Cycle'}`;
    }

    if (!messageText) {
      res.status(400).json({ success: false, error: 'Message content is required.' });
      return;
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChat,
        text: messageText,
        parse_mode: 'Markdown',
      }),
    });

    const tgData = await tgRes.json();
    if (tgData.ok) {
      res.json({
        success: true,
        messageId: tgData.result.message_id,
        chat: tgData.result.chat,
        recipient: targetChat,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(400).json({
        success: false,
        error: tgData.description || 'Telegram sendMessage rejected request',
        details: tgData,
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to dispatch Telegram notification' });
  }
});

// GET /api/database-evaluations - Retrieve evaluations from PostgreSQL/Supabase
app.get('/api/database-evaluations', async (_req: Request, res: Response): Promise<void> => {
  try {
    const pool = getDbPool();
    if (!pool) {
      res.json({ records: [], active: false, message: 'DATABASE_URL not configured' });
      return;
    }
    const queryRes = await pool.query(
      `SELECT * FROM intern_evaluations ORDER BY created_at DESC LIMIT 25`
    );
    res.json({ records: queryRes.rows, active: true, count: queryRes.rowCount });
  } catch (err: any) {
    res.status(500).json({ records: [], active: false, error: err.message });
  }
});

// POST /api/evaluate
app.post('/api/evaluate', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      internName = 'Intern',
      internEmail = 'intern@example.com',
      taskName = 'Milestone Technical Task',
      currentTaskNumber = 1,
      attemptNumber = 1,
      dueDate = '',
      benchmarkRequirements,
      internSubmission,
    } = req.body as EvaluationRequest;

    if (!benchmarkRequirements || !internSubmission) {
      res.status(400).json({
        error: 'Both benchmarkRequirements and internSubmission are required.',
      });
      return;
    }

    const currentTask = Math.min(48, Math.max(1, Number(currentTaskNumber) || 1));
    const currentAttempt = Math.max(1, Number(attemptNumber) || 1);

    // If Gemini client is available, run prompt with structured JSON responseSchema
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const promptText = `
You are an AI Internship Manager and Technical Evaluator. Your job is to strictly evaluate an intern's task submission against benchmark criteria, determine pass/revision status, and generate a fully formatted, ready-to-send HTML report email.

INPUT STRUCTURE:
TASK NUMBER: ${currentTask}
CANDIDATE NAME: ${internName}
CANDIDATE EMAIL: ${internEmail}

1. BENCHMARK TASK REQUIREMENTS (Problem statement & grading criteria):
${benchmarkRequirements}

2. INTERN SUBMISSION (Candidate's code, text, or presentation notes):
${internSubmission}

EVALUATION RULES:
1. Compare the Intern Submission against the Benchmark Requirements item-by-item.
2. If all core requirements are satisfied, set "task_status" to "PASSED" and "next_action" to "ADVANCE_TO_NEXT_TASK".
3. If essential requirements are missing, broken, or incomplete, set "task_status" to "NEEDS_REVISION" and "next_action" to "RETRY_CURRENT_TASK".
4. Calculate a completion_score from 0 to 100 representing the proportion of benchmark criteria satisfied.

OUTPUT REQUIREMENTS:
You MUST output strictly valid JSON matching this schema:
{
  "evaluation_summary": {
    "task_status": "PASSED" | "NEEDS_REVISION",
    "completion_score": 85,
    "next_action": "ADVANCE_TO_NEXT_TASK" | "RETRY_CURRENT_TASK",
    "strengths": [
      "Specific element done correctly"
    ],
    "missed_requirements": [
      "Specific benchmark item missing or incorrect"
    ],
    "actionable_fixes": [
      "Concrete step-by-step technical instructions on how to update the work"
    ]
  },
  "email_dispatch": {
    "to_subject": "Task Review Feedback: Task #${currentTask} - [Status]",
    "next_review_datetime": "YYYY-MM-DD HH:MM IST",
    "meet_presentation_link": "https://meet.google.com/xyz-abc-def",
    "body_html": "<div style='font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;'><h2 style='color: #1a73e8; margin-top: 0;'>Task Evaluation Report</h2><p>Hello <b>${internName}</b>,</p><p>Your submission has been reviewed by the AI Supervisor system.</p><div style='background-color: #f8f9fa; padding: 12px; border-left: 4px solid #1a73e8; margin: 15px 0;'><strong>Status:</strong> [STATUS_BADGE]<br><strong>Next Review Window:</strong> [NEXT_REVIEW_DATETIME]<br><strong>Presentation Link:</strong> <a href='[MEET_LINK]' style='color: #1a73e8;'>Join Google Meet</a></div><h3>What Went Well</h3><ul><li>[Strength 1]</li></ul><h3>Missed Requirements &amp; Items to Add</h3><ul><li>[Missed 1]</li></ul><h3>Required Updates &amp; Implementation Steps</h3><ol><li>[Fix Step 1]</li></ol><hr style='border: 0; border-top: 1px solid #eee; margin: 20px 0;'><p style='font-size: 13px; color: #666;'>Please upload your updated work to the bot before the next review window.</p></div>"
  }
}
`;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API call timed out')), 15000)
        );

        const geminiPromise = gemini.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            systemInstruction:
              'You are an AI Internship Manager and Technical Evaluator. Your job is to strictly evaluate an intern task submission against benchmark criteria, determine pass/revision status, and generate a fully formatted, ready-to-send HTML report email. Output strictly valid JSON matching the requested schema.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                evaluation_summary: {
                  type: Type.OBJECT,
                  properties: {
                    task_status: { type: Type.STRING, enum: ['PASSED', 'NEEDS_REVISION'] },
                    completion_score: { type: Type.INTEGER },
                    next_action: {
                      type: Type.STRING,
                      enum: ['ADVANCE_TO_NEXT_TASK', 'RETRY_CURRENT_TASK'],
                    },
                    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                    missed_requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
                    actionable_fixes: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: [
                    'task_status',
                    'completion_score',
                    'next_action',
                    'strengths',
                    'missed_requirements',
                    'actionable_fixes',
                  ],
                },
                email_dispatch: {
                  type: Type.OBJECT,
                  properties: {
                    to_subject: { type: Type.STRING },
                    next_review_datetime: { type: Type.STRING },
                    meet_presentation_link: { type: Type.STRING },
                    body_html: { type: Type.STRING },
                  },
                  required: [
                    'to_subject',
                    'next_review_datetime',
                    'meet_presentation_link',
                    'body_html',
                  ],
                },
              },
              required: ['evaluation_summary', 'email_dispatch'],
            },
          },
        });

        const response = await Promise.race([geminiPromise, timeoutPromise]);
        const rawText = response.text?.trim() || '{}';
        const parsed = JSON.parse(rawText);
        const validated = validateWorkflowEvaluationResult(parsed);

        if (validated.valid && validated.result) {
          const strictlyEnforced = enforceWorkflowTransitionRules(validated.result);
          // Persist to PostgreSQL if configured
          saveEvaluationToDb(strictlyEnforced, req.body).catch(() => {});
          
          res.json({
            evaluation: strictlyEnforced,
            meta: {
              model: 'gemini-3.8-flash',
              evaluatedAt: new Date().toISOString(),
              engine: 'gemini_ai',
            },
          });
          return;
        }
      } catch (geminiError) {
        console.warn('Gemini evaluation timed out or returned invalid format; utilizing deterministic evaluator:', geminiError);
      }
    }

    // Fallback deterministic evaluator for 48-task continuous program
    const fallbackResult = generateDeterministicWorkflowEvaluation({
      internName,
      internEmail,
      taskName,
      currentTaskNumber: currentTask,
      attemptNumber: currentAttempt,
      dueDate,
      benchmarkRequirements,
      internSubmission,
    });

    // Persist to PostgreSQL if configured
    saveEvaluationToDb(fallbackResult, req.body).catch(() => {});

    res.json({
      evaluation: fallbackResult,
      meta: {
        model: ai ? 'gemini-3.8-flash-fallback' : 'deterministic_evaluator',
        evaluatedAt: new Date().toISOString(),
        engine: 'deterministic_workflow_engine',
        note: ai ? 'Evaluated via strict deterministic workflow engine' : 'Evaluated via deterministic workflow engine',
      },
    });
  } catch (error) {
    console.error('Error evaluating submission:', error);
    res.status(500).json({ error: 'Internal server error while evaluating submission' });
  }
});

// POST /api/dispatch-email (Email queue dispatch & live SMTP / Resend delivery)
app.post('/api/dispatch-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { toEmail, internName, to_subject, subject, bodyHtml, apiKey: clientApiKey, preferProvider } = req.body;
    const finalSubject = to_subject || subject;

    if (!toEmail || !finalSubject || !bodyHtml) {
      res.status(400).json({ error: 'toEmail, subject (or to_subject), and bodyHtml are required.' });
      return;
    }

    const smtpUser = process.env.SENDER_EMAIL?.trim();
    const smtpPass = process.env.SENDER_APP_PASSWORD?.trim();
    const rawResendKey = clientApiKey || process.env.RESEND_API_KEY || '';
    const resendKey = typeof rawResendKey === 'string' ? rawResendKey.trim() : '';
    const fromEmail = smtpUser || process.env.FROM_EMAIL?.trim() || 'noreply@resend.dev';

    // 1. Direct Gmail SMTP Dispatch (Bypasses all domain verification and Google OAuth restrictions)
    const canUseSmtp = !!(smtpUser && smtpPass);
    const shouldTrySmtp = canUseSmtp && (preferProvider === 'smtp' || preferProvider !== 'resend');

    if (shouldTrySmtp) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true, // SSL
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const info = await transporter.sendMail({
          from: `"AI Internship Supervisor" <${smtpUser}>`,
          to: toEmail,
          subject: finalSubject,
          html: bodyHtml,
        });

        res.json({
          success: true,
          status: 'DELIVERED',
          messageId: info.messageId,
          recipient: toEmail,
          sender: smtpUser,
          internName: internName || 'Intern',
          timestamp: new Date().toISOString(),
          provider: 'Gmail SMTP (smtp.gmail.com:465 SSL Direct Delivery)',
          details: {
            messageId: info.messageId,
            accepted: info.accepted,
            response: info.response,
            subject: finalSubject,
          },
        });
        return;
      } catch (smtpErr: any) {
        console.warn('Gmail SMTP delivery notice/fallback:', smtpErr.message);
        // If the user explicitly requested SMTP only, return the error
        if (preferProvider === 'smtp') {
          res.status(400).json({
            success: false,
            error: smtpErr.message || 'Gmail SMTP dispatch failed',
            provider: 'Gmail SMTP Server',
            details: smtpErr,
          });
          return;
        }
        // Otherwise, continue to Resend fallback
      }
    }

    // 2. Resend API Dispatch
    if (resendKey && resendKey.startsWith('re_')) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `InternEval AI <${process.env.FROM_EMAIL?.trim() || 'noreply@resend.dev'}>`,
            to: [toEmail],
            subject: finalSubject,
            html: bodyHtml,
          }),
        });

        const resendData = await resendRes.json();
        if (resendRes.ok && resendData.id) {
          res.json({
            success: true,
            status: 'DELIVERED',
            messageId: resendData.id,
            recipient: toEmail,
            sender: process.env.FROM_EMAIL?.trim() || 'noreply@resend.dev',
            internName: internName || 'Intern',
            timestamp: new Date().toISOString(),
            provider: 'Resend API (Live Inbox Delivery)',
            details: {
              resendId: resendData.id,
              subject: finalSubject,
            },
          });
          return;
        } else {
          console.warn('Resend API returned error:', resendData);
          res.status(resendRes.status || 400).json({
            success: false,
            error: resendData.message || resendData.name || 'Resend delivery failed',
            provider: 'Resend API',
            details: resendData,
          });
          return;
        }
      } catch (e: any) {
        console.warn('Resend network/fetch error:', e);
        res.status(502).json({
          success: false,
          error: e.message || 'Network error connecting to Resend API',
          provider: 'Resend API',
        });
        return;
      }
    }

    const mockMessageId = `mock_queue_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

    res.json({
      success: true,
      status: 'OFFLINE_MOCK_DISPATCHED',
      messageId: mockMessageId,
      recipient: toEmail,
      sender: fromEmail,
      internName: internName || 'Intern',
      timestamp: new Date().toISOString(),
      provider: 'Local Mock Dispatch Queue (Set RESEND_API_KEY for live delivery)',
      details: {
        payloadSizeBytes: Buffer.byteLength(bodyHtml, 'utf8'),
        subject,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to dispatch email' });
  }
});

// POST /api/simulate-vapi-call (Simulate Vapi/Voice bot AI phone call)
app.post('/api/simulate-vapi-call', (req: Request, res: Response): void => {
  try {
    const { internName, internPhone, callScript, currentTask, nextAction } = req.body;
    const callId = `vapi_call_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

    res.json({
      success: true,
      callId,
      status: 'RINGING_SIMULATED',
      internName: internName || 'Intern',
      phoneNumber: internPhone || '+1 (555) 019-2834',
      currentTask: currentTask || 1,
      nextAction: nextAction || 'ADVANCE_TO_NEXT_TASK',
      voiceModel: 'Vapi / Gemini Live Voice Bot (Zephyr Voice Persona)',
      dispatchedScript: callScript,
      simulatedLatencyMs: 140,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to simulate voice bot call' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`InternEval AI 48-task workflow engine running on port ${PORT}`);
  });
}

startServer();
