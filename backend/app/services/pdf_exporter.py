import io
from typing import Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

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
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#ff6b00"),
        spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor("#71717a"),
        spaceAfter=15
    )
    heading2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#18181b"),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#27272a"),
        spaceAfter=8
    )
    callout_style = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#d97706"),
        spaceAfter=6
    )
    
    story = []
    
    # Header
    story.append(Paragraph(f"Retrievo — {unit_title}", title_style))
    story.append(Paragraph(f"Approved Study Material: <b>{asset_title}</b> | RAG-Grounded & Objective-Aligned", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#ff6b00"), spaceAfter=15))
    
    # Explanation
    if "explanation" in content_json:
        story.append(Paragraph("Concept Explanation", heading2_style))
        for para in content_json["explanation"].split("\n\n"):
            story.append(Paragraph(para.replace("**", "<b>").replace("<b>", "<b>", 1), body_style))
        story.append(Spacer(1, 10))
        
    # Steps for worked example
    if "steps" in content_json:
        story.append(Paragraph("Step-by-Step Solution Breakdown", heading2_style))
        for st in content_json["steps"]:
            story.append(Paragraph(f"<b>Step {st.get('step_number')}: {st.get('title')}</b>", body_style))
            story.append(Paragraph(st.get("description", ""), callout_style))
        story.append(Spacer(1, 10))
        
    # Questions
    if "questions" in content_json:
        story.append(Paragraph("Practice & Assessment Questions", heading2_style))
        for i, q in enumerate(content_json["questions"]):
            story.append(Paragraph(f"<b>Q{i+1}. {q.get('question')}</b>", body_style))
            options = q.get("options", {})
            for opt_key, opt_val in options.items():
                story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;<b>[{opt_key}]</b> {opt_val}", body_style))
            story.append(Spacer(1, 6))
            
    # Key Takeaways & Pitfalls for revision sheet
    if "key_takeaways" in content_json:
        story.append(Paragraph("Core Invariants & Rules", heading2_style))
        for item in content_json["key_takeaways"]:
            obj_name = item.get('concept') or item.get('objective') or 'Rule'
            story.append(Paragraph(f"• <b>{obj_name}</b>: {item.get('core_formula_rule', '')}", body_style))
            if item.get("pitfall_to_avoid"):
                story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;<i>Pitfall to Avoid:</i> {item.get('pitfall_to_avoid')}", callout_style))
        story.append(Spacer(1, 10))

    # Rapid Recall Triggers
    triggers = content_json.get("rapid_memory_triggers") or content_json.get("quick_recall_bullets")
    if triggers:
        story.append(Paragraph("Rapid Recall & Exam Triggers", heading2_style))
        for trig in triggers:
            story.append(Paragraph(f"▸ {trig}", body_style))
        story.append(Spacer(1, 10))

    # Domain Glossary
    glossary = content_json.get("glossary") or content_json.get("glossary_terms")
    if glossary:
        story.append(Paragraph("Authoritative Domain Glossary", heading2_style))
        for term_item in glossary:
            if isinstance(term_item, dict):
                story.append(Paragraph(f"<b>{term_item.get('term')}:</b> {term_item.get('canonical_wording')}", body_style))
        story.append(Spacer(1, 10))
        
    # Provenance Footer
    citations = content_json.get("chunk_citations", [])
    if citations:
        story.append(Spacer(1, 15))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e4e4e7"), spaceAfter=8))
        story.append(Paragraph(f"<b>Source Provenance Citations:</b> {', '.join(citations)}", callout_style))
        
    doc.build(story)
    return buffer.getvalue()
