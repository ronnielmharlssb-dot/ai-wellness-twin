import os
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class PitchDeckNumberedCanvas(canvas.Canvas):
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
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, page_count):
        self.saveState()
        
        # Header (slides > 1)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#0284C7"))
            self.drawString(40, 580, "AI WELLNESS TWIN")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawString(130, 580, "— Investor & Competition Pitch Deck (v1.0 MVP)")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(40, 574, 752, 574)

        # Footer
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        page_text = f"Slide {self._pageNumber} of {page_count}"
        self.drawRightString(752, 25, page_text)
        self.drawString(40, 25, "Confidential — AI Wellness Twin Inc. | https://ai-wellness-twin.vercel.app")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, 36, 752, 36)
        
        self.restoreState()

def build_pitch_deck(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(letter),
        leftMargin=40,
        rightMargin=40,
        topMargin=46,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()

    pill_style = ParagraphStyle(
        'PillStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#0284C7"),
        spaceAfter=4
    )

    slide_title = ParagraphStyle(
        'SlideTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=12
    )

    body_text = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=body_text,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor("#0F172A")
    )

    story = []

    # ==================== SLIDE 1: COVER ====================
    story.append(Spacer(1, 30))
    story.append(Paragraph("PROACTIVE WORKPLACE INTELLIGENCE", pill_style))
    story.append(Paragraph("AI Wellness Twin", ParagraphStyle('CoverTitle', fontName='Helvetica-Bold', fontSize=34, leading=40, textColor=colors.HexColor("#0F172A"), spaceAfter=8)))
    story.append(Paragraph("Intelligent Digital Twin for Proactive Workplace Burnout Prevention", ParagraphStyle('CoverSub', fontName='Helvetica', fontSize=14, leading=18, textColor=colors.HexColor("#0284C7"), spaceAfter=20)))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284C7"), spaceAfter=18))

    cover_meta = [
        [
            Paragraph("<b>Live Application:</b><br/><font color='#0284C7'>https://ai-wellness-twin.vercel.app</font>", body_text),
            Paragraph("<b>Key Innovation:</b><br/><font color='#059669'>2–4 Week Predictive Horizon</font>", body_text),
            Paragraph("<b>Privacy Architecture:</b><br/><font color='#7C3AED'>Strict k &ge; 3 Anonymity</font>", body_text)
        ]
    ]
    cm_table = Table(cover_meta, colWidths=[237, 237, 237])
    cm_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(cm_table)
    story.append(PageBreak())

    # ==================== SLIDE 2: THE PROBLEM ====================
    story.append(Paragraph("THE PROBLEM", pill_style))
    story.append(Paragraph("The $322 Billion Silent Workplace Burnout Crisis", slide_title))
    
    problem_cards = [
        [
            Paragraph("<b>76%</b><br/><b>Knowledge Worker Burnout</b><br/><font size=8.5 color='#64748B'>Acute cognitive exhaustion driven by endless context-switching and blurred boundaries.</font>", body_text),
            Paragraph("<b>21.5 hrs</b><br/><b>Weekly Meeting Overload</b><br/><font size=8.5 color='#64748B'>Schedule fragmentation leaves zero deep-work blocks, triggering late-night overtime.</font>", body_text),
            Paragraph("<b>Too Late</b><br/><b>Quarterly Surveys Fail</b><br/><font size=8.5 color='#64748B'>HR pulse surveys are retrospective. By the time scores dip, staff have already quit.</font>", body_text)
        ]
    ]
    p_table = Table(problem_cards, colWidths=[237, 237, 237])
    p_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FEF2F2")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#FECACA")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#FCA5A5")),
        ('PADDING', (0,0), (-1,-1), 14),
    ]))
    story.append(p_table)
    story.append(Spacer(1, 14))
    story.append(Paragraph("❌ <b>The Existing Dilemma:</b> Companies are forced to choose between invasive surveillance tools (which destroy trust) or useless retrospective surveys. There is no continuous, privacy-first alternative.", body_text))
    story.append(PageBreak())

    # ==================== SLIDE 3: THE SOLUTION ====================
    story.append(Paragraph("THE SOLUTION", pill_style))
    story.append(Paragraph("A Continuous, Calibrated Digital Twin", slide_title))
    
    solution_grid = [
        [
            Paragraph("<b>1. Multi-Modal Passive Telemetry</b><br/><font size=8.5 color='#64748B'>Passively aggregates signals across 9 workplace tools (IDE, GitHub, Calendar, Slack, ChatGPT, etc.) via metadata firewall.</font>", body_text),
            Paragraph("<b>2. 28-Day Personal Calibration</b><br/><font size=8.5 color='#64748B'>Evaluated strictly against an individual's historical rhythm. Zero peer leaderboards or toxic rankings.</font>", body_text)
        ],
        [
            Paragraph("<b>3. 'What-If' Twin Simulator</b><br/><font size=8.5 color='#64748B'>Interactive parameter simulation forecasting burnout recovery when meeting loads are reduced or focus blocks restored.</font>", body_text),
            Paragraph("<b>4. Strict k-Anonymity (k &ge; 3)</b><br/><font size=8.5 color='#64748B'>HR identifies systemic department hazards while mathematically guaranteeing zero individual snooping.</font>", body_text)
        ]
    ]
    s_table = Table(solution_grid, colWidths=[356, 356])
    s_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0F9FF")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#BAE6FD")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#BAE6FD")),
        ('PADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(s_table)
    story.append(PageBreak())

    # ==================== SLIDE 4: 9 INTEGRATIONS ====================
    story.append(Paragraph("DATA INGESTION ENGINE", pill_style))
    story.append(Paragraph("9 Supported Workday Integrations (Zero Content Logging)", slide_title))
    
    tools_rows = [
        [Paragraph("<b>🐙 GitHub:</b> Commit & PR timestamps", body_text), Paragraph("<b>💻 VS Code:</b> Focus session blocks", body_text), Paragraph("<b>🤖 ChatGPT:</b> AI reasoning pacing", body_text)],
        [Paragraph("<b>✨ Gemini:</b> Research session windows", body_text), Paragraph("<b>🧠 Claude:</b> Deep-work intervals", body_text), Paragraph("<b>📅 Calendar:</b> Meeting density & gaps", body_text)],
        [Paragraph("<b>🎨 Figma:</b> Design canvas active time", body_text), Paragraph("<b>💬 Slack:</b> After-hours messaging", body_text), Paragraph("<b>🎮 Discord:</b> Voice & community chat", body_text)]
    ]
    t_table = Table(tools_rows, colWidths=[237, 237, 237])
    t_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_table)
    story.append(Spacer(1, 14))
    story.append(Paragraph("🔒 <b>Metadata Firewall Guarantee:</b> Zero keystrokes, prompt contents, source code, or meeting titles are ever stored or transmitted.", ParagraphStyle('SecAlert', fontName='Helvetica-Bold', fontSize=9.5, textColor=colors.HexColor("#059669"))))
    story.append(PageBreak())

    # ==================== SLIDE 5: USER EXPERIENCE ====================
    story.append(Paragraph("USER EXPERIENCE", pill_style))
    story.append(Paragraph("Dual-Portal Architecture: Employee vs. HR Leadership", slide_title))
    
    portals = [
        [
            Paragraph("<b>👤 Employee Portal (/dashboard)</b><br/><font size=8.5 color='#64748B'>• Digital Twin Vitality Score (0–100)<br/>• 4-Axis Burnout Risk Radar<br/>• 'What-If' Parameter Simulator<br/>• MBI-GS Burnout Surveys<br/>• Personalized Micro-Habit Interventions</font>", body_text),
            Paragraph("<b>🛡️ HR Leadership Cockpit (/hr)</b><br/><font size=8.5 color='#64748B'>• Organization-Wide Vitality Radar<br/>• Department k &ge; 3 Privacy Lock Shield<br/>• Single-Use Cryptographic Invite Generator<br/>• Longitudinal Overtime Early Warning<br/>• Strict Zero Access to Employee Dashboards</font>", body_text)
        ]
    ]
    portal_table = Table(portals, colWidths=[356, 356])
    portal_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 14),
    ]))
    story.append(portal_table)
    story.append(PageBreak())

    # ==================== SLIDE 6: MARKET SIZE ====================
    story.append(Paragraph("MARKET OPPORTUNITY", pill_style))
    story.append(Paragraph("A Massive $61B+ Global Opportunity", slide_title))
    
    mkt_cards = [
        [
            Paragraph("<b>$61.2B</b><br/><b>TAM (Total Market)</b><br/><font size=8.5 color='#64748B'>Global corporate wellness & employee vitality market by 2027 (CAGR 7.4%).</font>", body_text),
            Paragraph("<b>$23.8B</b><br/><b>SAM (Serviceable)</b><br/><font size=8.5 color='#64748B'>B2B tech and remote workforce mental health & retention software.</font>", body_text),
            Paragraph("<b>$3.2B</b><br/><b>SOM (Initial Beachhead)</b><br/><font size=8.5 color='#64748B'>High-growth software engineering & design enterprises adopting active telemetry.</font>", body_text)
        ]
    ]
    mkt_table = Table(mkt_cards, colWidths=[237, 237, 237])
    mkt_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0FDF4")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#BBF7D0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#86EFAC")),
        ('PADDING', (0,0), (-1,-1), 14),
    ]))
    story.append(mkt_table)
    story.append(PageBreak())

    # ==================== SLIDE 7: BUSINESS MODEL ====================
    story.append(Paragraph("BUSINESS MODEL", pill_style))
    story.append(Paragraph("B2B SaaS Tiered Subscriptions", slide_title))
    
    pricing = [
        [
            Paragraph("<b>Starter</b><br/><b>$6 / seat / mo</b><br/><font size=8.5 color='#64748B'>For startups (10-50 seats). 4 core connectors, personal twin score, basic assessment.</font>", body_text),
            Paragraph("<b>Growth / Pro (Popular)</b><br/><b>$12 / seat / mo</b><br/><font size=8.5 color='#64748B'>For mid-market (50-500 seats). All 9 apps, 'What-If' simulator, HR k &ge; 3 radar.</font>", body_text),
            Paragraph("<b>Enterprise</b><br/><b>$18 / seat / mo</b><br/><font size=8.5 color='#64748B'>For 500+ seats. Custom telemetry webhooks, SSO / Okta, dedicated AI coach.</font>", body_text)
        ]
    ]
    price_table = Table(pricing, colWidths=[237, 237, 237])
    price_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 14),
    ]))
    story.append(price_table)
    story.append(PageBreak())

    # ==================== SLIDE 8: ROADMAP & ASK ====================
    story.append(Paragraph("ROADMAP & NEXT STEPS", pill_style))
    story.append(Paragraph("Join Us in Building the Future of Sustainable Work", slide_title))
    
    roadmap = [
        [
            Paragraph("<b>Phase 1: Production MVP</b><br/><font size=8 color='#059669'>COMPLETED · Q3 2026</font><br/><font size=8.5 color='#64748B'>Next.js 16 live deployment, 9 app integrations, Twin Simulator, role-isolated portals.</font>", body_text),
            Paragraph("<b>Phase 2: Wearable Biometrics</b><br/><font size=8 color='#0284C7'>IN PROGRESS · Q4 2026</font><br/><font size=8.5 color='#64748B'>Apple Watch, Oura, Whoop sync for sleep/HRV. Autonomous calendar buffer auto-blocking.</font>", body_text),
            Paragraph("<b>Phase 3: Autonomous Twin</b><br/><font size=8 color='#7C3AED'>FUTURE · 2027+</font><br/><font size=8.5 color='#64748B'>Enterprise workload auto-rebalancing, clinical burnout risk certification.</font>", body_text)
        ]
    ]
    road_table = Table(roadmap, colWidths=[237, 237, 237])
    road_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(road_table)
    story.append(Spacer(1, 16))
    story.append(Paragraph("🚀 <b>The Ask:</b> Seeking <b>Pilot Enterprise Partners</b> and <b>Pre-Seed Investment</b> to scale wearable integrations and enterprise sales.", ParagraphStyle('AskText', fontName='Helvetica-Bold', fontSize=10.5, textColor=colors.HexColor("#0F172A"))))
    story.append(Paragraph("Contact Founders: <font color='#0284C7'><b>ronnie@company.com</b></font> | <font color='#0284C7'><b>team@wellness-twin.ai</b></font>", body_text))

    doc.build(story, canvasmaker=PitchDeckNumberedCanvas)

if __name__ == "__main__":
    out_path = r"c:\Users\ronni\ai-wellness-twin\public\AI_Wellness_Twin_Pitch_Deck.pdf"
    build_pitch_deck(out_path)
    root_path = r"c:\Users\ronni\ai-wellness-twin\AI_Wellness_Twin_Pitch_Deck.pdf"
    build_pitch_deck(root_path)
    print(f"SUCCESS: Generated Pitch Deck PDF at {out_path} and {root_path}")
