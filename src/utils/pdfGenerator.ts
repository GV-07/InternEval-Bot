import { jsPDF } from 'jspdf';
import { WorkflowEvaluationResult, EvaluationRequest } from '../types/evaluator';

/**
 * Generates a formal, high-fidelity Technical Evaluation Report PDF
 * from the evaluation result state and initiates download.
 */
export function generateEvaluationPdf(
  result: WorkflowEvaluationResult,
  request: EvaluationRequest
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

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
    current_attempt: request.attemptNumber || 1,
    task_status: summary.task_status,
  };

  const email = result.email_dispatch || {
    next_review_datetime: '2026-11-04 18:00 IST',
    meet_presentation_link: 'https://meet.google.com/xyz-abc-def',
  };

  const isPassed = summary.task_status === 'PASSED';
  const primaryColor: [number, number, number] = isPassed ? [16, 185, 129] : [245, 158, 11]; // Emerald or Amber
  const darkNavy: [number, number, number] = [15, 23, 42]; // Slate 900
  const headerBg: [number, number, number] = [30, 41, 59]; // Slate 800

  // 1. Header Banner
  doc.setFillColor(...headerBg);
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('INTERNSHIP TECHNICAL EVALUATION REPORT', margin + 6, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text('InternEval AI Supervisor • Automated Rubric Verification Engine', margin + 6, y + 17);

  const reportId = `REF-${meta.current_task}-${Date.now().toString().slice(-6)}`;
  doc.setFontSize(8);
  doc.text(`ID: ${reportId}`, pageWidth - margin - 6, y + 10, { align: 'right' });
  doc.text(`Issued: ${new Date().toLocaleDateString()}`, pageWidth - margin - 6, y + 17, { align: 'right' });

  y += 28;

  // 2. Candidate & Task Metadata Box
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('CANDIDATE INFORMATION', margin + 4, y + 6);
  doc.text('TASK SPECIFICATION', margin + contentWidth / 2 + 2, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkNavy);
  doc.text(request.internName || 'Intern Candidate', margin + 4, y + 13);
  doc.text(`Task #${meta.current_task}: ${request.taskName || 'Technical Task'}`, margin + contentWidth / 2 + 2, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Email: ${request.internEmail || 'intern@example.com'}`, margin + 4, y + 20);
  doc.text(`Attempt: #${meta.current_attempt || 1}  •  Review Window: ${email.next_review_datetime}`, margin + contentWidth / 2 + 2, y + 20);

  y += 31;

  // 3. Evaluation Verdict & Score Card
  const verdictBg: [number, number, number] = isPassed ? [236, 253, 245] : [255, 251, 235];
  const verdictBorder: [number, number, number] = isPassed ? [167, 243, 208] : [253, 230, 138];
  doc.setFillColor(...verdictBg);
  doc.setDrawColor(...verdictBorder);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  // Status Badge Pill
  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin + 5, y + 5, 42, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(summary.task_status, margin + 26, y + 13.5, { align: 'center' });

  // Completion Score & Next Action
  doc.setTextColor(...darkNavy);
  doc.setFontSize(11);
  doc.text(`Completion Score: ${summary.completion_score}%`, margin + 52, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Next Action Authorized: `, margin + 52, y + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isPassed ? 5 : 180, isPassed ? 150 : 80, isPassed ? 105 : 20);
  doc.text(summary.next_action, margin + 89, y + 16);

  // Presentation Link info
  if (email.meet_presentation_link) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    doc.text(`Presentation Link: ${email.meet_presentation_link}`, pageWidth - margin - 5, y + 16, { align: 'right' });
  }

  y += 30;

  // Helper function to check and add new page if needed
  const checkPageOverflow = (heightNeeded: number) => {
    if (y + heightNeeded > pageHeight - margin - 15) {
      doc.addPage();
      y = margin + 5;
    }
  };

  // 4. SECTION: WHAT WENT WELL / STRENGTHS
  checkPageOverflow(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 118, 110); // Teal 700
  doc.text(`1. What Went Well / Strengths (${summary.strengths.length})`, margin, y);
  y += 4;
  doc.setDrawColor(204, 251, 241);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  if (summary.strengths.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('• No core strengths identified for this attempt.', margin + 4, y);
    y += 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    for (const item of summary.strengths) {
      const lines = doc.splitTextToSize(`[PASS]  ${item}`, contentWidth - 8);
      checkPageOverflow(lines.length * 4.5 + 2);
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
      doc.text('✓', margin + 2, y);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(lines, margin + 7, y);
      y += lines.length * 4.5 + 2;
    }
  }

  y += 4;

  // 5. SECTION: MISSED REQUIREMENTS
  checkPageOverflow(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(225, 29, 72); // Rose 600
  doc.text(`2. Missed Requirements & Items to Add (${summary.missed_requirements.length})`, margin, y);
  y += 4;
  doc.setDrawColor(254, 205, 211);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  if (summary.missed_requirements.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(16, 185, 129);
    doc.text('• None. All required benchmark criteria were verified and satisfied!', margin + 4, y);
    y += 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    for (const item of summary.missed_requirements) {
      const lines = doc.splitTextToSize(`[MISSED]  ${item}`, contentWidth - 8);
      checkPageOverflow(lines.length * 4.5 + 2);
      doc.setTextColor(239, 68, 68);
      doc.setFont('helvetica', 'bold');
      doc.text('✕', margin + 2, y);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(lines, margin + 7, y);
      y += lines.length * 4.5 + 2;
    }
  }

  y += 4;

  // 6. SECTION: REQUIRED TECHNICAL UPDATES & FIXES
  checkPageOverflow(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(217, 119, 6); // Amber 600
  doc.text(`3. Required Updates & Implementation Steps (${summary.actionable_fixes.length})`, margin, y);
  y += 4;
  doc.setDrawColor(253, 230, 138);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  if (summary.actionable_fixes.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('• No pending updates required. Proceed to the next milestone.', margin + 4, y);
    y += 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    summary.actionable_fixes.forEach((step, idx) => {
      const lines = doc.splitTextToSize(`Step ${idx + 1}: ${step}`, contentWidth - 10);
      checkPageOverflow(lines.length * 4.5 + 2);
      doc.setFillColor(245, 158, 11);
      doc.roundedRect(margin + 2, y - 3, 5, 4, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(String(idx + 1), margin + 4.5, y - 0.2, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(lines, margin + 9, y);
      y += lines.length * 4.5 + 2;
    });
  }

  // 7. Verification Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('InternEval AI Supervisor • Official Engineering Verification Document', margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  // Save the PDF file
  const filename = `Evaluation_Report_Task${meta.current_task}_${summary.task_status}_${request.internName?.replace(/\s+/g, '_') || 'Intern'}.pdf`;
  doc.save(filename);
}
