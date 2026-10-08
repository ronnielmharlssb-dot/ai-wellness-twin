"""Render the current system documentation to a shareable PDF.

Requires reportlab. Run from any directory with Python 3.10+.
Source of truth: docs/SYSTEM_DOCUMENTATION.md.
"""
from __future__ import annotations

import argparse
from html import escape
from pathlib import Path
import re
import textwrap

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, HRFlowable, KeepTogether, PageBreak,
    PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
INK = colors.HexColor('#173042')
TEAL = colors.HexColor('#087F8C')
MUTED = colors.HexColor('#516778')
PALE = colors.HexColor('#EDF6F7')
LINE = colors.HexColor('#D6E3E8')


def inline(raw: str) -> str:
    parts = re.split(r'(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))', raw)
    result = []
    for part in parts:
        if part.startswith('`') and part.endswith('`'):
            result.append('<font name="Courier" size="8.2" color="#087F8C">' + escape(part[1:-1]) + '</font>')
        elif part.startswith('**') and part.endswith('**'):
            result.append('<b>' + escape(part[2:-2]) + '</b>')
        elif match := re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', part):
            label, target = match.groups()
            result.append('<link href="' + escape(target, quote=True) + '" color="#087F8C">' + escape(label) + '</link>' if target.startswith('https://') else escape(label))
        else:
            result.append(escape(part))
    return ''.join(result)


class Architecture(Flowable):
    """PDF equivalent of the source's Mermaid architecture diagram."""
    def __init__(self, width: float):
        super().__init__()
        self.width, self.height = width, 262

    def draw(self):
        c = self.canv
        w = self.width
        box_w = (w - 32) / 2
        def box(x, y, title, subtitle):
            c.setFillColor(PALE)
            c.setStrokeColor(LINE)
            c.roundRect(x, y, box_w, 42, 6, stroke=1, fill=1)
            c.setFillColor(INK)
            c.setFont('Helvetica-Bold', 9)
            c.drawCentredString(x + box_w/2, y + 26, title)
            c.setFont('Helvetica', 8)
            c.setFillColor(MUTED)
            c.drawCentredString(x + box_w/2, y + 12, subtitle)
        def arrow(x1, y1, x2, y2):
            c.setStrokeColor(TEAL)
            c.setLineWidth(1.3)
            c.line(x1, y1, x2, y2)
            c.line(x2, y2, x2-3, y2+5)
            c.line(x2, y2, x2+3, y2+5)
        left, right = 0, box_w + 32
        centers = [box_w/2, right + box_w/2]
        box(left, 212, 'Employee + manual imports', 'Supabase-verified session')
        box(left, 147, 'Account-scoped device queues', 'Metadata / ownership validation')
        box(left, 82, 'Transactional PostgreSQL RPCs', 'Private daily observations')
        box(left, 17, 'Personal evidence + comparisons', 'Individual baseline and recent dates')
        for y in [212, 147, 82]:
            arrow(centers[0], y, centers[0], y-23)
        box(right, 212, 'Public fictional demo', 'Separate in-memory assessment')
        box(right, 82, 'Consent + contributor eligibility', 'Tenant / per-metric evidence rules')
        box(right, 17, 'Verified HR aggregates', 'Unsupported metrics withheld')
        c.setStrokeColor(TEAL)
        c.line(box_w, 103, right, 103)
        arrow(centers[1], 82, centers[1], 59)


class DocumentationPDF(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == 'Section':
            title = flowable.getPlainText()
            if not re.match(r'^\d+\.', title):
                return
            key = 'section-' + title.split('.')[0]
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(title, key, level=0, closed=False)
            self.notify('TOCEntry', (0, title, self.page, key))


def build(source: Path, output: Path):
    output.parent.mkdir(parents=True, exist_ok=True)
    style = {
        'body': ParagraphStyle('Body', fontName='Helvetica', fontSize=9.4, leading=14, textColor=INK, spaceAfter=8),
        'section': ParagraphStyle('Section', fontName='Helvetica-Bold', fontSize=15, leading=19, textColor=INK, spaceBefore=17, spaceAfter=10, keepWithNext=True),
        'sub': ParagraphStyle('Subsection', fontName='Helvetica-Bold', fontSize=10.5, leading=14, textColor=TEAL, spaceBefore=10, spaceAfter=7, keepWithNext=True),
        'cell': ParagraphStyle('Cell', fontName='Helvetica', fontSize=8.4, leading=11.6, textColor=INK, wordWrap='CJK'),
        'thead': ParagraphStyle('TableHead', fontName='Helvetica-Bold', fontSize=8.4, leading=11.6, textColor=colors.white, wordWrap='CJK'),
        'code': ParagraphStyle('Code', fontName='Courier', fontSize=8, leading=10.5, textColor=INK, leftIndent=9, rightIndent=9, backColor=PALE, borderPadding=8, spaceBefore=5, spaceAfter=12),
        'bullet': ParagraphStyle('BulletBody', fontName='Helvetica', fontSize=9.4, leading=14, textColor=INK, leftIndent=13, firstLineIndent=-10, spaceAfter=5),
    }
    width = A4[0] - 88
    doc = DocumentationPDF(str(output), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=55, bottomMargin=48,
                           title='AI Wellness Twin - System Documentation', author='AI Wellness Twin', subject='Current system, user workflows and deployment requirements')
    def page_chrome(canvas, document):
        canvas.saveState()
        if document.page > 1:
            canvas.setFillColor(MUTED)
            canvas.setFont('Helvetica', 8)
            canvas.drawString(44, A4[1]-30, 'AI WELLNESS TWIN | SYSTEM DOCUMENTATION')
            canvas.setStrokeColor(LINE)
            canvas.line(44, A4[1]-38, A4[0]-44, A4[1]-38)
        canvas.setStrokeColor(LINE)
        canvas.line(44, 37, A4[0]-44, 37)
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(44, 24, '7 October 2026 | Current implementation and verification limits')
        canvas.drawRightString(A4[0]-44, 24, str(document.page))
        canvas.restoreState()
    doc.addPageTemplates(PageTemplate(id='main', frames=[Frame(44, 48, width, A4[1]-103, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=page_chrome))
    story = [Spacer(1, 95), Paragraph('AI WELLNESS TWIN', ParagraphStyle('Eyebrow', fontName='Helvetica-Bold', fontSize=11, textColor=TEAL, spaceAfter=16)),
             Paragraph('System<br/>Documentation', ParagraphStyle('CoverTitle', fontName='Helvetica-Bold', fontSize=36, leading=41, textColor=INK, spaceAfter=24)),
             Paragraph('User workflows, architecture, data ingestion, privacy and deployment', ParagraphStyle('CoverSubtitle', fontName='Helvetica', fontSize=15, leading=22, textColor=MUTED, spaceAfter=24)),
             HRFlowable(width='100%', color=TEAL, thickness=2), Spacer(1, 20),
             Paragraph('7 October 2026 | Application 0.1.0<br/>Code checkpoint c014d5f', style['body']),
             Paragraph('A private work-pattern companion that compares each employee with their own earlier observations.', style['body']),
             Spacer(1, 16), Paragraph('<b>Demonstration and live operations are separate.</b><br/>The public sample is available without an account. Real account access, email delivery, applied migrations and authenticated ingestion still require live verification.', style['body']),
             Paragraph('<link href="https://ai-wellness-twin.vercel.app/demo" color="#087F8C">ai-wellness-twin.vercel.app/demo</link>', style['body']), PageBreak(),
             Paragraph('Contents', style['section'])]
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle('TOCLine', fontName='Helvetica', fontSize=10, leading=16, textColor=INK, spaceBefore=6, leftIndent=0, firstLineIndent=0)]
    story.extend([toc, Spacer(1, 22), Paragraph('This PDF is generated from docs/SYSTEM_DOCUMENTATION.md. Current source behavior takes precedence over legacy product and pitch exports.', style['body']), PageBreak()])
    lines = source.read_text(encoding='utf-8').splitlines()
    i = next(i for i, line in enumerate(lines) if line.startswith('## '))
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith('## '):
            story.append(Paragraph(inline(line[3:]), style['section']))
            i += 1
        elif line.startswith('### '):
            story.append(Paragraph(inline(line[4:]), style['sub']))
            i += 1
        elif line.startswith('```'):
            language = line[3:]
            block = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                block.append(lines[i])
                i += 1
            i += 1
            if language == 'mermaid':
                story.extend([Architecture(width), Spacer(1, 8)])
            else:
                wrapped = '\n'.join(textwrap.fill(row, width=90, subsequent_indent='  ', replace_whitespace=False) if len(row) > 90 else row for row in block)
                story.append(Preformatted(wrapped, style['code']))
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                row = [cell.strip() for cell in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', cell) for cell in row):
                    rows.append(row)
                i += 1
            count = len(rows[0])
            ratios = [0.33, 0.67] if count == 2 else [0.24, 0.32, 0.44]
            table = Table([[Paragraph(inline(cell), style['thead'] if n == 0 else style['cell']) for cell in row] for n, row in enumerate(rows)], colWidths=[width*r for r in ratios], repeatRows=1, hAlign='LEFT')
            table.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), INK), ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]), ('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),8), ('RIGHTPADDING',(0,0),(-1,-1),8), ('TOPPADDING',(0,0),(-1,-1),7), ('BOTTOMPADDING',(0,0),(-1,-1),7), ('LINEBELOW',(0,0),(-1,-1),0.3,LINE)]))
            story.extend([KeepTogether([table]) if len(rows) <= 7 else table, Spacer(1, 10)])
        elif line.startswith('- ') or re.match(r'^\d+\. ', line):
            story.append(Paragraph(inline(line), style['bullet']))
            i += 1
        else:
            block = [line]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r'^(#{2,3} |\||```|- |\d+\. )', lines[i].strip()):
                block.append(lines[i].strip())
                i += 1
            story.append(Paragraph(inline(' '.join(block)), style['body']))
    doc.multiBuild(story)
    print(f'Created {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT / 'docs/SYSTEM_DOCUMENTATION.md')
    parser.add_argument('--output', type=Path, default=ROOT / 'output/pdf/AI_Wellness_Twin_System_Documentation.pdf')
    args = parser.parse_args()
    build(args.source, args.output)
