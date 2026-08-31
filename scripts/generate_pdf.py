import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "AI Wellness Twin — Product & Operations Manual (v1.0 MVP)")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)

        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_text)
        self.drawString(54, 36, "Confidential — Evaluator & Operations Manual | https://ai-wellness-twin.vercel.app")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)
        
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0284C7"),
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#1E293B"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6
    )

    body_bold = ParagraphStyle(
        'Body_Bold',
        parent=body_style,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor("#0F172A")
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0F172A")
    )

    callout_style = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#1E293B")
    )

    story = []

    # --- COVER / HEADER ---
    story.append(Paragraph("AI WELLNESS TWIN", ParagraphStyle('Pill', fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor("#0284C7"), spaceAfter=4)))
    story.append(Paragraph("Product Specification & Operations Manual", title_style))
    story.append(Paragraph("Version 1.0 MVP — Intelligent Digital Twin for Workplace Wellbeing", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=12))

    # Meta Info Table
    meta_data = [
        [
            Paragraph("<b>Production URL:</b> <font color='#0284C7'>https://ai-wellness-twin.vercel.app</font>", body_style),
            Paragraph("<b>Date:</b> August 2026", body_style)
        ],
        [
            Paragraph("<b>Repository:</b> <font color='#0284C7'>github.com/ronnielmharlssb-dot/ai-wellness-twin</font>", body_style),
            Paragraph("<b>Evaluation Stage:</b> Stage 4 MVP", body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[330, 174])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # --- SECTION 1: EXECUTIVE SUMMARY ---
    story.append(Paragraph("1. Executive Summary", h1_style))
    story.append(Paragraph(
        "Modern knowledge workers face chronic, hidden burnout caused by fragmented focus, excessive meeting loads, and blurred after-hours boundaries. Traditional corporate wellness initiatives fail because they rely on reactive, quarterly surveys that employees do not trust.",
        body_style
    ))
    story.append(Paragraph(
        "<b>AI Wellness Twin</b> is a proactive, privacy-first digital twin platform. It passively monitors work pattern telemetry across 9 essential productivity tools (IDE, GitHub, Calendar, Slack, etc.) and combines it with active MBI-GS (Maslach Burnout Inventory) reflections. Each worker is calibrated against their own 28-day baseline to predict burnout risks and simulate corrective habits before exhaustion occurs.",
        body_style
    ))

    # Key Highlights Box
    highlights = [
        [
            Paragraph("<b>Bi-Directional Telemetry</b><br/><font size=8 color='#64748B'>Passive background signals + validated subjective surveys.</font>", body_style),
            Paragraph("<b>k-Anonymity (k &ge; 3)</b><br/><font size=8 color='#64748B'>HR views group stats only for 3+ members. Zero prompt logging.</font>", body_style),
            Paragraph("<b>What-If Simulator</b><br/><font size=8 color='#64748B'>Interactive parameter model simulating recovery trajectories.</font>", body_style)
        ]
    ]
    htable = Table(highlights, colWidths=[168, 168, 168])
    htable.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0F9FF")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#BAE6FD")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#BAE6FD")),
        ('PADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(htable)
    story.append(Spacer(1, 14))

    # --- SECTION 2: SYSTEM ARCHITECTURE & ROLES ---
    story.append(Paragraph("2. System Architecture & Role-Based Access Control (RBAC)", h1_style))
    story.append(Paragraph(
        "The system enforces <b>strict bi-directional role isolation</b> between employees and HR administrators:",
        body_style
    ))

    role_data = [
        [Paragraph("<b>Dimension</b>", body_bold), Paragraph("<b>Employee Role (employee)</b>", body_bold), Paragraph("<b>HR Admin Role (hr)</b>", body_bold)],
        [Paragraph("<b>Portal Route</b>", body_style), Paragraph("<font color='#0284C7'>/dashboard</font>", code_style), Paragraph("<font color='#059669'>/hr</font>", code_style)],
        [Paragraph("<b>Access Boundary</b>", body_style), Paragraph("Private personal twin; strictly blocked from /hr.", body_style), Paragraph("Workforce aggregate radar; strictly blocked from /dashboard.", body_style)],
        [Paragraph("<b>Data Visibility</b>", body_style), Paragraph("Personal metrics, MBI-GS scores, twin simulator, recommendations.", body_style), Paragraph("Anonymized group workload heatmaps, macro trends (k &ge; 3).", body_style)],
        [Paragraph("<b>Management Tools</b>", body_style), Paragraph("Personal integrations, profile, notification curfews.", body_style), Paragraph("Department teams, single-use invite token generator.", body_style)]
    ]
    rtable = Table(role_data, colWidths=[110, 197, 197])
    rtable.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(rtable)
    story.append(Spacer(1, 14))

    # --- SECTION 3: EMPLOYEE PORTAL WALKTHROUGH ---
    story.append(Paragraph("3. Employee Experience Portal (/dashboard)", h1_style))
    
    emp_features = [
        ("Overview (/dashboard)", "Real-time Twin Health Score (0-100), 4-axis Burnout Risk Radar, and live Workday Signals 3x3 grid."),
        ("Work Pattern Diagnostics (/dashboard/patterns)", "Analysis of meeting fragmentation, uninterrupted focus blocks, and after-hours activity."),
        ("MBI-GS Assessment Surveys (/dashboard/assessment)", "Scientifically validated Maslach Burnout Inventory questions evaluating Exhaustion, Cynicism, and Efficacy."),
        ("What-If Twin Simulator (/dashboard/simulator)", "Dynamic simulation engine forecasting burnout risk recovery based on meeting reductions and focus block adjustments."),
        ("Personalized Recommendations (/dashboard/recommendations)", "Actionable micro-habits and smart boundary recommendations tailored to personal telemetry."),
        ("Integrations Manager (/dashboard/integrations)", "Central management hub for OAuth connectors and background telemetry listeners across 9 apps.")
    ]
    for feat_title, feat_desc in emp_features:
        story.append(Paragraph(f"• <b>{feat_title}</b>: {feat_desc}", body_style))
    story.append(Spacer(1, 10))

    # --- SECTION 4: HR WORKFORCE PORTAL ---
    story.append(Paragraph("4. HR Workforce Administration Portal (/hr)", h1_style))
    hr_features = [
        ("Workforce Overview (/hr)", "Organizational vitality cockpit showing macro burnout radar, average rest buffers, and workload changes."),
        ("Teams & Groups (/hr/teams)", "Departmental management enforcing the strict k &ge; 3 privacy threshold. Sub-groups with < 3 members are locked to protect individuals."),
        ("Single-Use Invite Generator (/hr/teams)", "Cryptographic token generator to provision one-time onboarding invites for new company employees."),
        ("Longitudinal Workforce Trends (/hr/trends)", "Multi-cycle trend heatmaps tracking company-wide rest patterns and overtime sustainability.")
    ]
    for hf_title, hf_desc in hr_features:
        story.append(Paragraph(f"• <b>{hf_title}</b>: {hf_desc}", body_style))
    story.append(Spacer(1, 14))

    # --- SECTION 5: SUPPORTED INTEGRATIONS ---
    story.append(Paragraph("5. Supported Telemetry Integrations (9 Productivity Apps)", h1_style))
    story.append(Paragraph(
        "All integrations pass through the <b>Metadata Firewall</b>: timestamps and durations are captured, while sensitive prompt text, code snippets, and meeting titles are strictly stripped.",
        body_style
    ))

    tools_data = [
        [Paragraph("<b>App / Tool</b>", body_bold), Paragraph("<b>Category</b>", body_bold), Paragraph("<b>Telemetry Captured (Zero Text / Prompt Logging)</b>", body_bold)],
        [Paragraph("<b>GitHub</b>", body_style), Paragraph("Code & Commits", body_style), Paragraph("Commit & PR review timestamps to measure dev windows and late-night coding.", body_style)],
        [Paragraph("<b>VS Code</b>", body_style), Paragraph("Engineering Focus", body_style), Paragraph("Active editor focus time, typing pace, and uninterrupted deep-work blocks.", body_style)],
        [Paragraph("<b>ChatGPT (OpenAI)</b>", body_style), Paragraph("AI Reasoning", body_style), Paragraph("AI consultation session duration and frequency (prompt content firewalled 🔒).", body_style)],
        [Paragraph("<b>Google Gemini</b>", body_style), Paragraph("AI Research", body_style), Paragraph("Research & analysis intervals and focus intensity (prompts discarded 🔒).", body_style)],
        [Paragraph("<b>Claude (Anthropic)</b>", body_style), Paragraph("AI Writing", body_style), Paragraph("Writing & reasoning session durations (zero prompt text logging 🔒).", body_style)],
        [Paragraph("<b>Google Calendar</b>", body_style), Paragraph("Meetings & Syncs", body_style), Paragraph("Meeting density, call duration, and rest buffer gaps (event titles stripped 🔒).", body_style)],
        [Paragraph("<b>Figma</b>", body_style), Paragraph("Design & Creative", body_style), Paragraph("Design canvas active windows and creative flow session durations.", body_style)],
        [Paragraph("<b>Slack</b>", body_style), Paragraph("Communication", body_style), Paragraph("Active messaging timestamps outside core hours to protect right-to-disconnect.", body_style)],
        [Paragraph("<b>Discord</b>", body_style), Paragraph("Voice & Community", body_style), Paragraph("Voice channel and community active windows to monitor late-night habits.", body_style)]
    ]
    ttable = Table(tools_data, colWidths=[105, 110, 289])
    ttable.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 4.5),
    ]))
    story.append(ttable)
    story.append(Spacer(1, 14))

    # --- SECTION 6: PRIVACY & ETHICS ---
    story.append(Paragraph("6. Privacy Architecture & Ethical Framework", h1_style))
    ethics = [
        "<b>1. k-Anonymity (k &ge; 3):</b> HR administrators can never view individual employee scores. Aggregate department scores require a minimum of 3 members.",
        "<b>2. Self-Referential Baselines:</b> Every worker is calibrated against their own 28-day historical pattern. There are zero company leaderboards or peer rankings.",
        "<b>3. Zero Keystroke / Prompt Logging:</b> Telemetry is strictly metadata-only. Prompts, chat text, and source code are never parsed or stored.",
        "<b>4. Complete Role Isolation:</b> Employees have zero access to HR tools; HR admins are strictly prevented from viewing individual employee dashboards."
    ]
    for eth in ethics:
        story.append(Paragraph(f"• {eth}", body_style))
    story.append(Spacer(1, 14))

    # --- SECTION 7: TEST ACCOUNTS ---
    story.append(Paragraph("7. Test Accounts & Verification Guide", h1_style))
    story.append(Paragraph(
        "Reviewers can test both roles on the live production deployment at <font color='#0284C7'><b>https://ai-wellness-twin.vercel.app</b></font>:",
        body_style
    ))

    acc_data = [
        [Paragraph("<b>Role</b>", body_bold), Paragraph("<b>Email</b>", body_bold), Paragraph("<b>Password</b>", body_bold), Paragraph("<b>Portal URL</b>", body_bold), Paragraph("<b>Key Capabilities to Test</b>", body_bold)],
        [
            Paragraph("<b>👤 Employee</b>", body_style),
            Paragraph("ronnie@company.com", code_style),
            Paragraph("password123", code_style),
            Paragraph("/dashboard", code_style),
            Paragraph("Health score, 9-app grid, MBI-GS survey, twin simulator, weekly reports.", body_style)
        ],
        [
            Paragraph("<b>🛡️ HR Admin</b>", body_style),
            Paragraph("hr@company.com", code_style),
            Paragraph("password123", code_style),
            Paragraph("/hr", code_style),
            Paragraph("Workforce overview radar, team k &ge; 3 guard, single-use invite generator, trends.", body_style)
        ]
    ]
    atable = Table(acc_data, colWidths=[70, 110, 75, 75, 174])
    atable.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(atable)
    story.append(Spacer(1, 8))
    story.append(Paragraph("💡 <i>Tip: The /login page features instant 1-click buttons for both Employee and HR Admin for immediate evaluation.</i>", callout_style))

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)

if __name__ == "__main__":
    out_dir = r"c:\Users\ronni\ai-wellness-twin\public"
    pdf_path = os.path.join(out_dir, "AI_Wellness_Twin_Product_Manual.pdf")
    build_pdf(pdf_path)
    # Also copy to root
    root_path = r"c:\Users\ronni\ai-wellness-twin\AI_Wellness_Twin_Product_Manual.pdf"
    build_pdf(root_path)
    print(f"SUCCESS: Generated PDF at {pdf_path} and {root_path}")
