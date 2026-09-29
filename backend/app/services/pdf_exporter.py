import io
import re
import html
from typing import Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def safe_xml(text: Any) -> str:
    """Safely escapes text for ReportLab's XML-based Paragraph parser."""
    if text is None:
        return ""
    s = str(text).strip()
    if not s:
        return ""
    
    # Pre-convert markdown bold **text** to placeholder
    s = re.sub(r'\*\*(.*?)\*\*', r'§B_START§\1§B_END§', s)
    s = re.sub(r'\*(.*?)\*', r'§I_START§\1§I_END§', s)
    
    # Escape XML entities (&, <, >)
    s = html.escape(s)
    
    # Restore bold and italic
    s = s.replace('§B_START§', '<b>').replace('§B_END§', '</b>')
    s = s.replace('§I_START§', '<i>').replace('§I_END§', '</i>')
    
    # Replace newlines with breaks if needed
    s = s.replace('\n', '<br/>')
    return s

def generate_learning_pack_pdf(unit_title: str, asset_title: str, content_json: Dict[str, Any]) -> bytes:
    """
    Renders approved learning packs or revision sheets into a clean, print-ready PDF (§9).
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#ea580c"),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor("#52525b"),
        spaceAfter=12
    )
    heading2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=10,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=6
    )
    callout_style = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontSize=9,
        leading=12.5,
        textColor=colors.HexColor("#c2410c"),
        spaceAfter=5
    )
    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#334155"),
        leftIndent=12,
        spaceAfter=4
    )
    
    story = []
    
    # Header
    story.append(Paragraph(safe_xml(f"Retrievo Learning Platform — {unit_title}"), title_style))
    story.append(Paragraph(f"Approved Study Material: <b>{safe_xml(asset_title)}</b> | RAG Ground-Truth Verified", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#ea580c"), spaceAfter=12))
    
    # 1. Explanation Section
    explanation = content_json.get("explanation")
    if explanation:
        story.append(Paragraph("Core Concept Explanation", heading2_style))
        for para in str(explanation).split("\n\n"):
            para_clean = para.strip()
            if para_clean:
                story.append(Paragraph(safe_xml(para_clean), body_style))
        story.append(Spacer(1, 8))
        
    # Key Summary Points
    summary_points = content_json.get("short_summary_points") or content_json.get("key_points")
    if summary_points and isinstance(summary_points, list):
        story.append(Paragraph("Key Takeaway Points", heading2_style))
        for idx, pt in enumerate(summary_points):
            if isinstance(pt, dict):
                topic = pt.get("topic", f"Point #{idx+1}")
                summary_text = pt.get("summary", "")
                story.append(Paragraph(f"• <b>{safe_xml(topic)}</b>: {safe_xml(summary_text)}", bullet_style))
            else:
                story.append(Paragraph(f"• {safe_xml(pt)}", bullet_style))
        story.append(Spacer(1, 8))
        
    # 2. Worked Examples / Steps
    steps = content_json.get("steps")
    if steps and isinstance(steps, list):
        story.append(Paragraph("Step-by-Step Worked Execution", heading2_style))
        problem = content_json.get("problem_statement")
        if problem:
            story.append(Paragraph(f"<b>Problem Context:</b> {safe_xml(problem)}", callout_style))
        for st in steps:
            if isinstance(st, dict):
                step_num = st.get('step_number') or ''
                step_title = st.get('title') or f"Step {step_num}"
                desc = st.get("description", "")
                val_check = st.get("validation_check", "")
                story.append(Paragraph(f"<b>Step {safe_xml(step_num)}: {safe_xml(step_title)}</b>", body_style))
                if desc:
                    story.append(Paragraph(safe_xml(desc), bullet_style))
                if val_check:
                    story.append(Paragraph(f"<i>Validation Check:</i> {safe_xml(val_check)}", callout_style))
        method_exp = content_json.get("method_explanation")
        if method_exp:
            story.append(Paragraph(f"<b>Methodology Takeaway:</b> {safe_xml(method_exp)}", callout_style))
        story.append(Spacer(1, 8))
        
    # 3. Key Takeaways & Pitfalls for revision sheet
    key_takeaways = content_json.get("key_takeaways")
    if key_takeaways and isinstance(key_takeaways, list):
        story.append(Paragraph("Core Architectural Rules & Invariants", heading2_style))
        for item in key_takeaways:
            if isinstance(item, dict):
                obj_name = item.get('concept') or item.get('objective') or 'Rule'
                rule = item.get('core_formula_rule', '')
                pitfall = item.get('pitfall_to_avoid', '')
                story.append(Paragraph(f"• <b>{safe_xml(obj_name)}</b>: {safe_xml(rule)}", bullet_style))
                if pitfall:
                    story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;<b>Pitfall to Avoid:</b> {safe_xml(pitfall)}", callout_style))
            else:
                story.append(Paragraph(f"• {safe_xml(item)}", bullet_style))
        story.append(Spacer(1, 8))

    # Rapid Recall Triggers
    triggers = content_json.get("rapid_memory_triggers") or content_json.get("quick_recall_bullets")
    if triggers and isinstance(triggers, list):
        story.append(Paragraph("Rapid Recall & Exam Triggers", heading2_style))
        for trig in triggers:
            story.append(Paragraph(f"▸ {safe_xml(trig)}", bullet_style))
        story.append(Spacer(1, 8))

    # 4. Domain Glossary
    glossary = content_json.get("glossary") or content_json.get("glossary_terms")
    if glossary and isinstance(glossary, list):
        story.append(Paragraph("Authoritative Domain Glossary", heading2_style))
        for term_item in glossary:
            if isinstance(term_item, dict):
                term = term_item.get('term', '')
                canonical = term_item.get('canonical_wording', '')
                story.append(Paragraph(f"• <b>{safe_xml(term)}</b>: {safe_xml(canonical)}", bullet_style))
        story.append(Spacer(1, 8))

    # 5. Assessment / Practice Questions
    questions = content_json.get("questions")
    if questions and isinstance(questions, list):
        story.append(Paragraph("Formative & Practice Questions", heading2_style))
        for i, q in enumerate(questions):
            if isinstance(q, dict):
                q_text = q.get('question') or q.get('question_text') or f"Question {i+1}"
                story.append(Paragraph(f"<b>Q{i+1}. {safe_xml(q_text)}</b>", body_style))
                options = q.get("options", {})
                if isinstance(options, dict):
                    for opt_key, opt_val in options.items():
                        story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;<b>[{safe_xml(opt_key)}]</b> {safe_xml(opt_val)}", bullet_style))
                story.append(Spacer(1, 4))
        story.append(Spacer(1, 8))
        
    # Provenance Footer
    citations = content_json.get("chunk_citations", [])
    if citations and isinstance(citations, list):
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
        story.append(Paragraph(f"<b>Source Provenance Citations:</b> {safe_xml(', '.join(citations))}", callout_style))
        
    doc.build(story)
    return buffer.getvalue()

