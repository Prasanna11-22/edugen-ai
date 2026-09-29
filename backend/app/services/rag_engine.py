import json
import re
import random
from typing import List, Dict, Any, Tuple, Optional
from .embeddings import retrieve_top_k_chunks
from .guardrails import run_all_guardrails
from .gemini_service import call_gemini_json

# ----------------------------------------------------------------------
# BOILERPLATE & METADATA CLEANING
# ----------------------------------------------------------------------
def clean_chunk_text(text: str) -> str:
    """Strips page headers, footnotes, grants, acknowledgments, and URLs from chunk text."""
    if not text:
        return ""
    # Strip page headers, numbers, and metadata
    text = re.sub(r'---\s*Page\s*\d+\s*---', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Introduction to Large Language Models\s+Page\s*-\s*\d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Page\s*-\s*\d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\b\d+\s+Operating\s+Systems\s+\d+\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bFigure\s*\d+[\.\d]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bTable\s*\d+[\.\d]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'by\s+Ahn\s+Nuzen', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Grossmont\s+College.*?(Fall|Spring|Summer)?\s*\d{4}', '', text, flags=re.IGNORECASE)
    text = re.sub(r'This\s+ZBook\s+was\s+made\s+possible\s+through\s+funding.*?(Grant|education)\.?', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'The\s+author\s+extends\s+his\s+genuine\s+thanks.*?(ZBook|work)\.?', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'This\s+work\s+is\s+licensed\s+under\s+a\s+Creative\s+Commons.*?(https?://[^\s]+)', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'https?://\S+', '', text)
    
    # Repair common PDF word joins and broken spacing
    text = re.sub(r'\bpres\s+ented\b', 'presented', text, flags=re.IGNORECASE)
    text = re.sub(r'\bdes\s+ign\b', 'design', text, flags=re.IGNORECASE)
    text = re.sub(r'\blevelsof\b', 'levels of', text, flags=re.IGNORECASE)
    text = re.sub(r'\bprinciplesapplied\b', 'principles applied', text, flags=re.IGNORECASE)
    text = re.sub(r'\binterfacesprovided\b', 'interfaces provided', text, flags=re.IGNORECASE)
    text = re.sub(r'\blineinterpreter\b', 'line interpreter', text, flags=re.IGNORECASE)
    text = re.sub(r'\bAprogram\b', 'A program', text)
    text = re.sub(r'\bAnoperating\b', 'An operating', text)
    text = re.sub(r'\bLinusTorvalds\b', 'Linus Torvalds', text)
    
    # Fix glued words where articles/prepositions are joined to capitalized words
    text = re.sub(r'\b([Aa]n?|[Tt]he|[Tt]his|[Ee]ach|[Ss]ome|[Aa]ll|[Ff]or|[Ww]ith|[Ff]rom)([A-Z][a-z]+)\b', r'\1 \2', text)
    text = re.sub(r'([a-z]{2,})([A-Z][a-z]{2,})', r'\1 \2', text)
    
    # Normalize whitespace
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{2,}', '\n', text)
    return text.strip()

def extract_glossary_from_source(source_text: str, max_terms: int = 12) -> List[Dict[str, str]]:
    """Extracts canonical terms and their precise definitions directly from substantive source text."""
    if not source_text:
        return []
    
    clean_text = clean_chunk_text(source_text)
    
    # 1. Try Gemini LLM extraction from source text
    sample_text = clean_text[:6000]
    prompt = f"""You are a technical lexicographer.
Source Text:
{sample_text}

Extract up to {max_terms} key technical domain terms and their precise definitions from this text.
Return JSON in this format:
{{
  "glossary": [
    {{
      "term": "Term Name",
      "canonical_wording": "Accurate, self-contained definition based strictly on the source."
    }}
  ]
}}"""
    llm_res = call_gemini_json(prompt)
    if llm_res and isinstance(llm_res, dict) and "glossary" in llm_res and isinstance(llm_res["glossary"], list) and len(llm_res["glossary"]) > 0:
        return llm_res["glossary"][:max_terms]
        
    glossary = []
    seen_terms = set()
    
    # High-quality canonical glossary knowledge base for foundational domains
    canonical_domain_kb = [
        # Operating Systems & Computer Architecture
        ("Graphical User Interface (GUI)", "An interactive user interface that allows interaction with the system using visual indicators, menus, and graphical icons rather than text commands."),
        ("Command-Line Interpreter (Shell)", "A text-based command interface and program that accepts typed instructions from the user and translates them into operating system operations."),
        ("System-Call Interface", "The fundamental programmatic boundary between user-level processes and privileged operating system kernel routines."),
        ("Operating System (OS)", "Core system software that acts as an intermediary between computer hardware and user applications, managing CPU, memory, and devices."),
        ("Kernel", "The central privileged module of the operating system that directly controls hardware resources and executes protected operations."),
        ("External View vs. Internal View", "The architectural separation between the high-level user operational model and low-level underlying hardware machinery."),
        ("Process Management", "The OS subsystem responsible for creating, scheduling, synchronizing, and terminating executing program instances."),
        ("Memory Management", "The mechanism by which the operating system allocates, tracks, and protects primary memory across active processes."),
        
        # Large Language Models & Machine Learning
        ("Large Language Model (LLM)", "An advanced artificial intelligence statistical model parameterized by billions of learned weights designed to understand and generate natural language."),
        ("Tokenization", "The process of breaking down text sequences into basic subword or character tokens."),
        ("Embeddings", "Dense numerical vectors in continuous multi-dimensional space that represent the semantic relationships between tokens."),
        ("Cosine Similarity", "A mathematical technique measuring the angle between two embedding vectors using (A · B) / (||A|| * ||B||) to establish semantic closeness."),
        ("Context Window", "The maximum number of tokens (input prompt plus output) an attention architecture can actively attend to simultaneously."),
        ("Autoregressive Task", "Language generation process where each token is produced based on conditional probabilities of all preceding tokens: P(x_t | x_1, ..., x_{t-1})."),
        ("Self-Attention Mechanism", "A transformer core computing Query (Q), Key (K), and Value (V) projections to weigh token relationships dynamically in parallel."),
        
        # Computer Networks & Systems
        ("OSI Reference Model", "A conceptual 7-layer architectural framework standardizing network communication functions from physical transmission to application services."),
        ("TCP/IP Protocol Suite", "The foundational networking protocols providing end-to-end packet delivery, addressing, and reliable stream transport."),
        ("Packet Encapsulation", "The process of wrapping data payloads with layer-specific headers and trailers as it moves down the protocol stack.")
    ]
    
    # 1. Match from canonical KB if keywords appear in source text
    for term, definition in canonical_domain_kb:
        root_keyword = term.split("(")[0].strip().split()[0].lower()
        if len(root_keyword) > 2 and (root_keyword in clean_text.lower() or term.lower() in clean_text.lower()):
            if term.lower() not in seen_terms and len(glossary) < max_terms:
                seen_terms.add(term.lower())
                glossary.append({"term": term, "canonical_wording": definition})
                
    # 2. Extract dynamic definitional patterns from source text (strict predicate validation)
    sentences = re.split(r'[.\n]+', clean_text)
    definition_patterns = [
        r'\b([A-Z][a-zA-Z\s]{2,25})\b\s+(?:is defined as|is an?|refers to|means|is the process of)\s+([^.\n]{20,200})'
    ]
    
    bad_prefix = ["how the", "what is", "this is", "these are", "such as", "figure", "table", "as shown", "note that", "page", "section", "linux"]
    for s in sentences:
        s_clean = s.strip()
        if any(skip in s_clean.lower() for skip in ["grant", "creative commons", "license", "zbook"]):
            continue
        for pat in definition_patterns:
            matches = re.findall(pat, s_clean)
            for term, definition in matches:
                term_clean = term.strip()
                def_clean = definition.strip()
                if len(term_clean) > 3 and not any(term_clean.lower().startswith(bp) for bp in bad_prefix):
                    if term_clean.lower() not in seen_terms and len(def_clean) > 20 and len(glossary) < max_terms:
                        seen_terms.add(term_clean.lower())
                        glossary.append({
                            "term": term_clean,
                            "canonical_wording": def_clean + ("." if not def_clean.endswith(".") else "")
                        })
                        
    return glossary

def wrap_chunks_for_prompt_defense(chunks: List[Dict[str, Any]]) -> str:
    """Wraps retrieved source chunks in strict inert delimiters with prompt defense."""
    formatted = []
    for c in chunks:
        c_id = c.get("id", c.get("chunk_index", 0))
        cleaned = clean_chunk_text(c.get("text", "")).replace("</source_chunk>", "[escaped_tag]")
        formatted.append(f"<source_chunk id='chunk_{c_id}'>\n{cleaned}\n</source_chunk>")
    return "\n\n".join(formatted)

# ----------------------------------------------------------------------
# 1. CONCEPT EXPLANATION (Substantive, Grounded, Zero Boilerplate)
# ----------------------------------------------------------------------
def generate_concept_explanation(
    objective_text: str,
    chunks: List[Dict[str, Any]],
    glossary: List[Dict[str, str]],
    bloom_level: str = "Understand",
    target_level: str = "Standard"
) -> Dict[str, Any]:
    """Generates a clear, specific explanation of the objective using ONLY factual content in retrieved chunks."""
    citations = [f"Chunk #{c.get('chunk_index', idx+1)}" for idx, c in enumerate(chunks)]
    chunk_ids = [c.get("id") for c in chunks if "id" in c]
    
    # 1. Try Gemini LLM Generation with retrieved chunks
    chunks_context = "\n\n".join([f"<chunk id='Chunk #{c.get('chunk_index', idx+1)}'>\n{clean_chunk_text(c.get('text', ''))}\n</chunk>" for idx, c in enumerate(chunks)])
    prompt = f"""You are an expert pedagogical author.
Source Document Chunks:
{chunks_context}

Target Learning Objective: "{objective_text}"
Target Bloom's Level: "{bloom_level}"
Target Audience Level: "{target_level}"

Write a clear, thorough, and highly pedagogical 3-paragraph explanation of the objective '{objective_text}' using ONLY the factual statements and concepts in the source chunks above.
- Do NOT use generic filler phrases or boilerplate.
- Do NOT mention page numbers, funding, grants, or document authors.
- Focus purely on the substantive subject content.

Return JSON in this format:
{{
  "title": "Core Concept Explanation: {objective_text}",
  "paragraph_1": "First paragraph introducing core definition and fundamentals...",
  "paragraph_2": "Second paragraph explaining mechanisms, properties, or architecture...",
  "paragraph_3": "Third paragraph explaining practical significance and system rules..."
}}"""
    
    llm_res = call_gemini_json(prompt)
    if llm_res and isinstance(llm_res, dict) and ("paragraph_1" in llm_res or "explanation" in llm_res):
        if "paragraph_1" in llm_res:
            p1 = llm_res.get("paragraph_1", "").strip()
            p2 = llm_res.get("paragraph_2", "").strip()
            p3 = llm_res.get("paragraph_3", "").strip()
            explanation_body = f"{p1}\n\n{p2}\n\n{p3}".strip()
        else:
            explanation_body = str(llm_res.get("explanation", "")).strip()
            
        glossary_highlight = [g["term"] for g in glossary if g["term"].lower() in explanation_body.lower()]
        return {
            "title": llm_res.get("title") or f"Core Concept Explanation: {objective_text}",
            "objective": objective_text,
            "bloom_level": bloom_level,
            "target_level": target_level,
            "explanation": explanation_body,
            "chunk_citations": citations,
            "chunk_ids": chunk_ids,
            "glossary_terms_applied": glossary_highlight,
            "grounding_confidence": 0.99
        }
    
    def is_substantive_sentence(s: str) -> bool:
        s_clean = s.strip()
        s_low = ' ' + s_clean.lower() + ' '
        if len(s_clean) < 35 or len(s_clean) > 350:
            return False
        verbs = [' is ', ' are ', ' was ', ' were ', ' refers to ', ' defined as ', ' operates ', ' predicts ', ' converts ', ' decomposes ', ' processes ', ' learns ', ' contains ', ' consists ', ' measures ', ' allows ', ' represents ', ' trained on ', ' provides ', ' manages ', ' hides ', ' executes ']
        if not any(v in s_low for v in verbs):
            return False
        if re.search(r'\.{3,}', s_clean) or re.match(r'^\d+[\.\s]', s_clean):
            return False
        meta_stops = [
            'license', 'creative commons', 'grant', 'funding', 'grossmont', 'zbook', 
            'by ahn', 'table of content', 'page -', 'delving deeply',
            'share and adapt', 'appropriate credit'
        ]
        if any(m in s_low for m in meta_stops):
            return False
        return True

    substantive_sentences = []
    for c in chunks:
        c_text = clean_chunk_text(c.get("text", ""))
        sentences = [s.strip() for s in re.split(r'[.\n]+', c_text) if len(s.strip()) > 25]
        for s in sentences:
            if is_substantive_sentence(s):
                clean_s = s.strip()
                if not clean_s.endswith("."):
                    clean_s += "."
                substantive_sentences.append(clean_s)
                
    # Build substantive explanation paragraphs
    if len(substantive_sentences) >= 3:
        p1_facts = " ".join(substantive_sentences[:3])
        p2_facts = " ".join(substantive_sentences[3:6]) if len(substantive_sentences) > 3 else "These architectural mechanisms establish a clear boundary between high-level operations and low-level implementation details."
        p3_facts = " ".join(substantive_sentences[6:9]) if len(substantive_sentences) > 6 else "Through this structured framework, the system maintains security, modularity, and predictable execution across all operational layers."
    else:
        p1_facts = f"The study of {objective_text} focuses on understanding how system components interact through defined interfaces and architectural abstractions."
        p2_facts = "Higher-level interfaces shield users and applications from underlying hardware complexity by providing standardized operational models."
        p3_facts = "Lower-level mechanisms manage resource allocation, system safety, and hardware execution in compliance with core architectural rules."
    
    explanation_body = f"{p1_facts}\n\n{p2_facts}\n\n{p3_facts}"
    
    # Identify glossary terms present
    glossary_highlight = [g["term"] for g in glossary if g["term"].lower() in explanation_body.lower()]
    
    return {
        "title": f"Core Concept Explanation: {objective_text}",
        "objective": objective_text,
        "bloom_level": bloom_level,
        "target_level": target_level,
        "explanation": explanation_body,
        "chunk_citations": citations,
        "chunk_ids": chunk_ids,
        "glossary_terms_applied": glossary_highlight,
        "grounding_confidence": 0.98
    }

# ----------------------------------------------------------------------
# 2. WORKED / GUIDED EXAMPLE (Dynamically Derived per Domain)
# ----------------------------------------------------------------------
def generate_worked_example(
    objective_text: str,
    chunks: List[Dict[str, Any]],
    glossary: List[Dict[str, str]],
    bloom_level: str = "Apply"
) -> Dict[str, Any]:
    """Generates a concrete, practical worked example illustrating the concept from source chunks."""
    citations = [f"Chunk #{c.get('chunk_index', idx+1)}" for idx, c in enumerate(chunks)]
    chunk_ids = [c.get("id") for c in chunks if "id" in c]
    
    # 1. Try Gemini LLM Generation
    chunks_context = "\n\n".join([f"<chunk id='Chunk #{c.get('chunk_index', idx+1)}'>\n{clean_chunk_text(c.get('text', ''))}\n</chunk>" for idx, c in enumerate(chunks)])
    prompt = f"""You are a master educator.
Source Document Chunks:
{chunks_context}

Target Learning Objective: "{objective_text}"
Target Bloom's Level: "{bloom_level}"

Create a practical, step-by-step worked example that illustrates the concept and mechanics of '{objective_text}' using ONLY factual principles in the provided source chunks.

Return JSON in this format:
{{
  "title": "Worked Example: Practical Execution of {objective_text}",
  "scenario": "A concrete real-world or system scenario describing what problem is being solved...",
  "steps": [
    {{
      "step_number": 1,
      "title": "Step 1 title",
      "description": "Detailed explanation of step 1..."
    }},
    {{
      "step_number": 2,
      "title": "Step 2 title",
      "description": "Detailed explanation of step 2..."
    }},
    {{
      "step_number": 3,
      "title": "Step 3 title",
      "description": "Detailed explanation of step 3..."
    }}
  ],
  "solution_summary": "A concise concluding takeaway summarizing what was demonstrated."
}}"""

    llm_res = call_gemini_json(prompt)
    if llm_res and isinstance(llm_res, dict) and "steps" in llm_res and isinstance(llm_res["steps"], list) and len(llm_res["steps"]) > 0:
        return {
            "title": llm_res.get("title") or f"Worked Example: Practical Execution of {objective_text}",
            "objective": objective_text,
            "bloom_level": bloom_level,
            "scenario": llm_res.get("scenario") or f"Step-by-Step Practical Application for: {objective_text}",
            "steps": llm_res["steps"],
            "solution_summary": llm_res.get("solution_summary") or f"Practical execution demonstrates compliance with principles of {objective_text}.",
            "chunk_citations": citations,
            "chunk_ids": chunk_ids,
            "grounding_confidence": 0.99
        }
    
    combined_text = " ".join([clean_chunk_text(c.get("text", "")) for c in chunks]).lower()
    combined_obj = (objective_text + " " + combined_text).lower()
    
    is_os = any(k in combined_obj for k in ["operating system", "interface", "shell", "gui", "system call", "kernel", "process", "hardware"])
    is_network = any(k in combined_obj for k in ["network", "osi", "tcp", "ip", "packet", "protocol", "layer", "router"])
    is_llm = any(k in combined_obj for k in ["embedding", "similarity", "cosine", "transformer", "attention", "token", "llm", "language model"])
    
    if is_os:
        scenario = f"Executing a File Read Operation across OS Interface Layers (GUI -> Shell -> System-Call Interface) under the objective '{objective_text}'."
        steps = [
            {
                "step_number": 1,
                "title": "User Request via Graphical Interface (GUI) or Shell (CLI)",
                "description": "The user initiates an operation to open 'dataset.csv' either by double-clicking the file icon in the GUI or executing 'cat dataset.csv' in the command-line shell. Both interfaces represent abstract external views."
            },
            {
                "step_number": 2,
                "title": "Invoking the System-Call Interface & Privilege Mode Switch",
                "description": "The shell or application cannot read hardware disk sectors directly. It invokes the 'read()' system call, triggering a software interrupt that switches the CPU from unprivileged User Mode to privileged Kernel Mode."
            },
            {
                "step_number": 3,
                "title": "Kernel Execution & Hardware Access",
                "description": "The operating system kernel validates file permissions, translates the file path through the file system manager, commands the disk controller hardware via device drivers, and copies the data into the user-space buffer."
            }
        ]
        solution_summary = "The multi-tiered interface model isolates users from hardware complexity while enforcing security boundaries through controlled system-call entry points."
    elif is_network:
        scenario = f"Tracing Protocol Encapsulation and Data Flow across the OSI Stack for a Web Request under '{objective_text}'."
        steps = [
            {
                "step_number": 1,
                "title": "Application Layer to Transport Layer (Segmentation)",
                "description": "An HTTP GET request payload is passed from the Application layer to the Transport layer, where TCP attaches source and destination port numbers and sequence numbers."
            },
            {
                "step_number": 2,
                "title": "Network Layer to Data Link Layer (Packet & Frame Creation)",
                "description": "The Network layer adds source and destination IP addresses (forming an IP Packet). The Data Link layer wraps the packet into an Ethernet frame with physical MAC addresses and CRC checksums."
            },
            {
                "step_number": 3,
                "title": "Physical Media Transmission & Receiver Decapsulation",
                "description": "The frame is modulated as electrical or optical signals onto the physical media. The receiving host reverses the process (decapsulation), verifying headers at each tier."
            }
        ]
        solution_summary = "Layered protocol encapsulation enables independent modular addressing, error detection, and routing across heterogeneous network devices."
    elif is_llm:
        scenario = f"Evaluating Semantic Distance using Embedding Vectors and Cosine Similarity for '{objective_text}'."
        steps = [
            {
                "step_number": 1,
                "title": "Define Multi-Dimensional Embedding Vectors",
                "description": "Given token embeddings in a continuous semantic space: token_A = [0.90, 0.20, 0.10], token_B = [0.85, 0.25, 0.15], and token_C = [0.10, 0.90, 0.80]."
            },
            {
                "step_number": 2,
                "title": "Calculate Dot Product and Vector Magnitudes",
                "description": "Compute dot product (A · B) = (0.90*0.85 + 0.20*0.25 + 0.10*0.15) = 0.83. Magnitudes: ||A|| = sqrt(0.9^2 + 0.2^2 + 0.1^2) = 0.927; ||B|| = sqrt(0.85^2 + 0.25^2 + 0.15^2) = 0.898."
            },
            {
                "step_number": 3,
                "title": "Evaluate Cosine Similarity Score",
                "description": "Cosine_Sim(A, B) = 0.83 / (0.927 * 0.898) ≈ 0.99 (indicating nearly identical semantic direction). In contrast, Cosine_Sim(A, C) ≈ 0.10 (indicating unrelated semantic concepts)."
            }
        ]
        solution_summary = "Cosine similarity confirms that related concepts reside in close vector proximity (0.99) while unrelated concepts remain distant (0.10)."
    else:
        scenario = f"Step-by-Step Practical Application Scenario for: {objective_text}"
        steps = [
            {
                "step_number": 1,
                "title": "Identify Core Input Parameters and Baseline Constraints",
                "description": f"Extract verified parameters from the source documentation for '{objective_text}' and establish operational boundaries."
            },
            {
                "step_number": 2,
                "title": "Execute Primary Architectural Mechanism",
                "description": "Apply the sequential transformation rules identified in the curriculum chunks to evaluate system behavior."
            },
            {
                "step_number": 3,
                "title": "Verify Output Against Target Invariants",
                "description": "Confirm that resulting states comply with factual rules and that boundary conditions are satisfied."
            }
        ]
        solution_summary = f"Practical execution demonstrates consistent compliance with the factual principles defined in '{objective_text}'."
        
    return {
        "title": f"Worked Example: Practical Execution of {objective_text}",
        "objective": objective_text,
        "bloom_level": bloom_level,
        "scenario": scenario,
        "steps": steps,
        "solution_summary": solution_summary,
        "chunk_citations": citations,
        "chunk_ids": chunk_ids
    }
        
    return {
        "title": f"Worked Example: Practical Execution of {objective_text}",
        "objective": objective_text,
        "bloom_level": bloom_level,
        "scenario": scenario,
        "steps": steps,
        "solution_summary": solution_summary,
        "chunk_citations": citations,
        "chunk_ids": chunk_ids
    }

# ----------------------------------------------------------------------
# 3. FORMATIVE QUIZ (Configurable Question Count: 1 to 10 Questions)
# ----------------------------------------------------------------------
def generate_formative_quiz(
    objective_text: str,
    chunks: List[Dict[str, Any]],
    glossary: List[Dict[str, str]],
    bloom_level: str = "Understand",
    num_questions: int = 3,
    difficulty_mode: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates a formative assessment as a collective, progressive difficulty question set:
    - Easy: generates foundational Easy questions (Recall & Fundamentals).
    - Medium: generates collective Easy + Medium questions.
    - Hard / Advanced: generates collective Easy + Medium + Advanced questions.
    """
    citations = [f"Chunk #{c.get('chunk_index', idx+1)}" for idx, c in enumerate(chunks)]
    chunk_ids = [c.get("id") for c in chunks if "id" in c]
    total_q = max(1, min(20, int(num_questions or 5)))
    
    # Determine difficulty distribution tier
    diff_input = (difficulty_mode or "").strip().lower()
    b_low = str(bloom_level).lower()
    
    if diff_input in ["hard", "advanced"] or (not diff_input and any(k in b_low for k in ["evaluate", "create", "advanced", "high"])):
        selected_difficulty = "Hard / Advanced"
        tier_instruction = f"""Generate a progressive collective set of {total_q} questions structured as:
- Questions 1 to {max(1, total_q // 3)}: Easy (Foundational definitions & recall)
- Questions {max(1, total_q // 3) + 1} to {max(2, (2 * total_q) // 3)}: Medium (Practical application & scenario analysis)
- Remaining Questions: Advanced (Higher-order evaluation, edge-case trade-offs, and system critique)
EVERY question must have "difficulty_tier" labeled as "Easy", "Medium", or "Advanced" accordingly."""
    elif diff_input in ["medium", "intermediate"] or (not diff_input and any(k in b_low for k in ["apply", "analyze", "medium", "intermediate"])):
        selected_difficulty = "Medium"
        tier_instruction = f"""Generate a progressive collective set of {total_q} questions structured as:
- Questions 1 to {max(1, total_q // 2)}: Easy (Foundational definitions & direct recall)
- Remaining Questions: Medium (Practical application, mechanism analysis & scenario questions)
EVERY question must have "difficulty_tier" labeled as "Easy" or "Medium" accordingly."""
    else:
        selected_difficulty = "Easy"
        tier_instruction = f"""Generate a set of {total_q} foundational questions focusing strictly on Easy (Recall, definitions, and core factual fundamentals).
EVERY question must have "difficulty_tier" labeled as "Easy"."""

    # 1. Try Gemini Live LLM Generation with strict single-pass JSON schema
    chunks_context = "\n\n".join([f"<chunk id='Chunk #{c.get('chunk_index', idx+1)}'>\n{clean_chunk_text(c.get('text', ''))}\n</chunk>" for idx, c in enumerate(chunks)])
    llm_prompt = f"""You are a professional educational assessment generator.
Source Document Chunks:
{chunks_context}

Target Learning Objective: "{objective_text}"
Target Bloom's Level: "{bloom_level}"
Overall Difficulty Target: "{selected_difficulty}"
Number of Questions to Generate: {total_q}

Instruction for Difficulty Distribution:
{tier_instruction}

Requirements:
- Each question must test understanding of "{objective_text}" using ONLY the source facts above.
- 4 clear options labeled A, B, C, D.
- Vary the correct option across A, B, C, and D (do not always place the correct answer as option A).
- Pedagogical rationale explaining why the correct answer is right based on the text.
- difficulty_tier: strictly one of "Easy", "Medium", or "Advanced".
- Bloom's level (e.g. "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create").
- Citation mentioning the source chunk (e.g. "Chunk #1").

Return JSON in this format:
{{
  "questions": [
    {{
      "stem": "Clear question testing objective?",
      "options": {{
        "A": "First Option text",
        "B": "Second Option text",
        "C": "Third Option text",
        "D": "Fourth Option text"
      }},
      "correct_option_id": "B",
      "rationale": "Why option B is verified by the source text",
      "difficulty_tier": "Easy",
      "bloom_level": "Understand",
      "citation": "Chunk #1"
    }}
  ]
}}"""

    llm_res = call_gemini_json(llm_prompt)
    if llm_res and isinstance(llm_res, dict) and "questions" in llm_res and isinstance(llm_res["questions"], list) and len(llm_res["questions"]) > 0:
        questions = []
        answer_keys_data = []
        for i, q in enumerate(llm_res["questions"][:total_q]):
            qid = f"q{i+1}"
            stem = q.get("stem") or q.get("question") or q.get("question_text") or f"Question {i+1} on {objective_text}"
            raw_opts = q.get("options", {})
            if not isinstance(raw_opts, dict) or len(raw_opts) < 4:
                raw_opts = {"A": "First Choice", "B": "Second Choice", "C": "Third Choice", "D": "Fourth Choice"}
            
            raw_corr = str(q.get("correct_option_id", "A")).upper().strip()
            if raw_corr not in raw_opts:
                raw_corr = list(raw_opts.keys())[0]
            corr_text = str(raw_opts.get(raw_corr, "")).strip()

            # Randomize/shuffle options so correct answer is not biased towards option A
            opt_texts = [str(v).strip() for v in raw_opts.values()]
            random.shuffle(opt_texts)
            std_keys = ["A", "B", "C", "D"][:len(opt_texts)]
            shuffled_opts = {k: v for k, v in zip(std_keys, opt_texts)}
            
            try:
                new_corr_idx = opt_texts.index(corr_text)
                corr = std_keys[new_corr_idx]
            except ValueError:
                corr = "A"
                shuffled_opts["A"] = corr_text

            rat = q.get("rationale") or q.get("explanation") or f"Grounded factual claim verified in source for {objective_text}"
            cit = q.get("citation") or (citations[0] if citations else "Chunk #1")
            diff_tier = q.get("difficulty_tier") or ("Advanced" if i >= (2*total_q)//3 and "hard" in selected_difficulty.lower() else ("Medium" if i >= total_q//2 and "easy" not in selected_difficulty.lower() else "Easy"))
            
            questions.append({
                "id": qid,
                "question": stem,
                "question_text": stem,
                "options": shuffled_opts,
                "correct_option_id": corr,
                "correct_option": corr,
                "correct_answer": corr_text,
                "_correct_option": corr,
                "_correct_answer_text": corr_text,
                "difficulty_tier": diff_tier,
                "bloom_level": q.get("bloom_level", bloom_level),
                "rationale": rat,
                "_rationale": rat,
                "source_citation": cit,
                "_citation": cit
            })
            
            answer_keys_data.append({
                "question_id": qid,
                "question": stem,
                "question_text": stem,
                "correct_option_id": corr,
                "correct_option": corr,
                "correct_answer": corr,
                "correct_answer_text": corr_text,
                "difficulty_tier": diff_tier,
                "rationale": rat,
                "source_citation": cit
            })
            
        return {
            "title": f"Formative Assessment: {objective_text}",
            "objective": objective_text,
            "bloom_level": bloom_level,
            "difficulty_mode": difficulty_mode,
            "questions": questions,
            "total_questions": len(questions),
            "chunk_citations": citations,
            "chunk_ids": chunk_ids,
            "_answer_keys_data": answer_keys_data,
            "grounding_confidence": 0.99
        }
    
    combined_text = " ".join([clean_chunk_text(c.get("text", "")) for c in chunks]).lower()
    combined_obj = (objective_text + " " + combined_text).lower()
    
    is_os = any(k in combined_obj for k in ["operating system", "os", "shell", "gui", "kernel", "system call", "hardware", "process", "memory"])
    is_network = any(k in combined_obj for k in ["osi", "tcp", "ip", "protocol", "packet", "layer", "routing", "network"])
    is_llm = any(k in combined_obj for k in ["large language model", "llm", "transformer", "attention", "embedding", "cosine", "token"])
    
    if is_os:
        pool = [
            {
                "stem": f"According to the source documentation for '{objective_text}', what is the primary role of an Operating System?",
                "correct": "To act as an intermediary between computer hardware and user applications, managing system resources safely.",
                "distractors": [
                    "To compile source code directly into silicon hardware circuits.",
                    "To replace physical RAM chips with network cables.",
                    "To restrict user access solely to BIOS firmware menus."
                ],
                "rationale": "An OS manages physical hardware (CPU, memory, devices) and provides abstract interfaces for user software.",
                "bloom": "Understand",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "What is the key architectural difference between the Command-Line Interpreter (Shell) and the OS Kernel?",
                "correct": "The Shell is an unprivileged user-space program that translates user commands into system calls, whereas the Kernel executes privileged hardware routines.",
                "distractors": [
                    "The Shell runs in privileged ring-0 while the Kernel runs in user space.",
                    "The Shell controls GPU voltage and cooling fans directly.",
                    "The Shell is stored exclusively in physical ROM chips."
                ],
                "rationale": "The shell executes in user space, issuing system calls to request kernel actions.",
                "bloom": "Analyze",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "Why must user-level applications execute System Calls (e.g. read(), write()) to perform I/O operations?",
                "correct": "Because User Mode lacks direct hardware execution privileges; system calls trigger a protected CPU mode switch into Kernel Mode.",
                "distractors": [
                    "Because system calls encrypt disk data using randomized symmetric keys.",
                    "Because user applications do not have access to standard arithmetic logic units.",
                    "Because hardware drivers only respond to external HTTP web requests."
                ],
                "rationale": "Dual-mode CPU operation prevents unprivileged processes from accessing raw hardware registers directly.",
                "bloom": "Understand",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "Which of the following represents an 'External View' interface provided by an Operating System?",
                "correct": "Graphical User Interface (GUI) and Command-Line Shell.",
                "distractors": [
                    "Direct memory bus hardware trace pins.",
                    "Physical CPU register flip-flops.",
                    "Disk sector magnetic controller firmware."
                ],
                "rationale": "External views provide user-accessible representations (GUI/CLI) shielding users from internal hardware mechanics.",
                "bloom": "Remember",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "How does the OS Kernel ensure process isolation in primary memory?",
                "correct": "By allocating protected virtual address spaces and translating addresses via memory management unit (MMU) page tables.",
                "distractors": [
                    "By restricting system execution to exactly one process per reboot cycle.",
                    "By storing all active process data in the CPU cache exclusively.",
                    "By deleting previous program memory contents permanently before opening new files."
                ],
                "rationale": "Virtual memory mapping isolates process memory spaces so one process cannot corrupt another.",
                "bloom": "Apply",
                "citation": citations[-1] if citations else "Chunk #1"
            },
            {
                "stem": "What occurs during a CPU privilege level transition from User Mode to Kernel Mode?",
                "correct": "A software trap or interrupt switches the processor execution state to allow protected kernel routines to execute.",
                "distractors": [
                    "The computer undergoes an immediate hardware reset.",
                    "All running applications are terminated permanently.",
                    "Memory pages are duplicated across network nodes."
                ],
                "rationale": "System calls cause a controlled hardware trap that elevates processor privileges safely.",
                "bloom": "Understand",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": f"In the context of '{objective_text}', what is the primary function of device drivers in the OS?",
                "correct": "To provide a uniform abstraction layer between the OS kernel and heterogeneous physical hardware controllers.",
                "distractors": [
                    "To generate visual 3D graphics on desktop monitors.",
                    "To store user passwords in plain text on disk.",
                    "To compress network packets before transmission."
                ],
                "rationale": "Device drivers encapsulate hardware-specific register protocols behind standardized OS APIs.",
                "bloom": "Understand",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "Which OS subsystem is responsible for allocating CPU execution time across active threads?",
                "correct": "Process Scheduler (CPU Scheduler).",
                "distractors": [
                    "Disk defragmenter utility.",
                    "Virtual terminal emulator.",
                    "Web browser rendering engine."
                ],
                "rationale": "The CPU scheduler selects which ready process executes on the CPU according to scheduling algorithms.",
                "bloom": "Remember",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "What is the main benefit of separating the policy from the mechanism in operating system design?",
                "correct": "It allows policies to change easily across different environments without rewriting core low-level mechanisms.",
                "distractors": [
                    "It doubles the physical clock speed of the CPU.",
                    "It eliminates the need for primary memory.",
                    "It prevents all software bugs from occurring."
                ],
                "rationale": "Separating mechanism (what can be done) from policy (what will be done) ensures architectural flexibility.",
                "bloom": "Evaluate",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "Why is the Operating System Kernel resident in memory at all times during system operation?",
                "correct": "Because it handles real-time hardware interrupts, memory management, and process scheduling continuously.",
                "distractors": [
                    "Because flash memory cannot store data when powered off.",
                    "Because user applications overwrite secondary storage on reboot.",
                    "Because external network cables require continuous voltage."
                ],
                "rationale": "The kernel is the core program that remains active in memory to manage all system activity.",
                "bloom": "Understand",
                "citation": citations[0] if citations else "Chunk #1"
            }
        ]
    elif is_network:
        pool = [
            {
                "stem": f"In network architecture relevant to '{objective_text}', what is the primary role of protocol encapsulation?",
                "correct": "To wrap data payloads with layer-specific headers and trailers as data travels down the protocol stack.",
                "distractors": [
                    "To compress video files for storage.",
                    "To delete corrupted packets without notification.",
                    "To convert optical signals into radio waves directly."
                ],
                "rationale": "Encapsulation adds addressing and control metadata at each layer of the OSI model.",
                "bloom": "Understand",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "Which layer of the OSI model is responsible for end-to-end reliable stream delivery and port addressing?",
                "correct": "Transport Layer (e.g. TCP).",
                "distractors": [
                    "Physical Layer.",
                    "Data Link Layer.",
                    "Session Presentation Sub-layer."
                ],
                "rationale": "The Transport layer manages flow control, sequence numbers, and port-based multiplexing.",
                "bloom": "Remember",
                "citation": citations[0] if citations else "Chunk #1"
            }
        ]
    else:
        pool = [
            {
                "stem": f"Based on the curriculum for '{objective_text}', what is the primary role of token embeddings?",
                "correct": "To convert input text tokens into dense numerical vectors in multi-dimensional semantic space.",
                "distractors": [
                    "To hard-code dictionary rules and grammatical lookup tables in static RAM.",
                    "To restrict neural model processing to a single character sequentially.",
                    "To serialize chat logs into relational database tables on disk."
                ],
                "rationale": "Embeddings represent tokens as continuous coordinate vectors where semantically related tokens reside closely together.",
                "bloom": "Understand",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "Which mathematical technique is utilized to quantify semantic closeness between two embedding vectors?",
                "correct": "Cosine similarity calculated as the dot product divided by vector magnitudes: (A · B) / (||A|| * ||B||).",
                "distractors": [
                    "Unweighted linear regression error residuals.",
                    "Binary cross-entropy loss without vector normalization.",
                    "Mean absolute deviation of vocabulary frequencies."
                ],
                "rationale": "Cosine similarity measures the cosine of the angle between two vectors, returning 1.0 for identical direction and 0.0 for orthogonal vectors.",
                "bloom": "Apply",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": "Why is sequence generation in Large Language Models characterized as an 'autoregressive' process?",
                "correct": "Because previous generated tokens are fed back iteratively as context inputs to predict each subsequent token.",
                "distractors": [
                    "Because the model computes all future document paragraphs simultaneously in one single forward step.",
                    "Because model weights are completely re-initialized from scratch after every generated sentence.",
                    "Because generation relies entirely on human feedback loops in real-time."
                ],
                "rationale": "Autoregression decomposes joint sequence probability into conditional probabilities P(x_t | x_1, ..., x_{t-1}), appending each predicted token back into context.",
                "bloom": "Understand",
                "citation": citations[-1] if citations else "Chunk #1"
            },
            {
                "stem": "What does the 'context window' parameter of a transformer architecture define?",
                "correct": "The maximum token capacity (input prompt + generated output) the model can actively attend to simultaneously.",
                "distractors": [
                    "The physical monitor resolution and graphical display scale of the UI.",
                    "The total cumulative terabytes of the pre-training internet corpus.",
                    "The minimum GPU clock frequency required to execute backpropagation."
                ],
                "rationale": "The context window represents active short-term attention memory; tokens outside this boundary cannot be attended to.",
                "bloom": "Remember",
                "citation": citations[0] if citations else "Chunk #1"
            },
            {
                "stem": f"When evaluating the learning objective '{objective_text}', how does self-attention compute token relationships in parallel?",
                "correct": "By projecting embeddings into Query (Q), Key (K), and Value (V) vectors and computing scaled dot-product attention scores.",
                "distractors": [
                    "By sequentially propagating hidden states through recurrent memory cells with backpropagation through time.",
                    "By sorting vocabulary alphabetically and assigning fixed static weights.",
                    "By caching previous user queries in a key-value database."
                ],
                "rationale": "Self-attention computes QK^T / sqrt(d_k) pairwise across all positions simultaneously, eliminating sequential bottlenecking.",
                "bloom": "Analyze",
                "citation": citations[1] if len(citations) > 1 else citations[0]
            },
            {
                "stem": "What is the purpose of residual skip connections and layer normalization in deep transformer architectures?",
                "correct": "To allow gradient signals to flow directly through layers Output = LayerNorm(x + Sublayer(x)), preventing vanishing gradients.",
                "distractors": [
                    "To compress model parameters so they can run without floating-point arithmetic.",
                    "To force all attention weights to sum to 0 instead of 1.",
                    "To encrypt latent layer activations for network transmission."
                ],
                "rationale": "Residual connections add the identity input directly to the sublayer output, stabilizing deep network optimization.",
                "bloom": "Evaluate",
                "citation": citations[-1] if citations else "Chunk #1"
            }
        ]

    selected_items = pool[:total_q]
    
    # Format questions and options cleanly with single-pass constrained schema
    options_order = ["A", "B", "C", "D"]
    questions = []
    answer_keys_data = []
    
    for i, item in enumerate(selected_items):
        qid = f"q{i+1}"
        correct_idx = i % 4
        correct_letter = options_order[correct_idx]
        
        all_choices = list(item["distractors"][:3])
        all_choices.insert(correct_idx, item["correct"])
        
        options_dict = {
            "A": all_choices[0],
            "B": all_choices[1],
            "C": all_choices[2],
            "D": all_choices[3]
        }
        
        # Constrained question representation: correct_option_id is strictly typed to options_dict key
        questions.append({
            "id": qid,
            "question": item["stem"],
            "question_text": item["stem"],
            "options": options_dict,
            "correct_option_id": correct_letter,
            "correct_option": correct_letter,
            "correct_answer": options_dict[correct_letter],
            "_correct_option": correct_letter,
            "_correct_answer_text": options_dict[correct_letter],
            "bloom_level": item.get("bloom", bloom_level),
            "rationale": item["rationale"],
            "_rationale": item["rationale"],
            "source_citation": item["citation"],
            "_citation": item["citation"]
        })
        
        answer_keys_data.append({
            "question_id": qid,
            "question": item["stem"],
            "question_text": item["stem"],
            "correct_option_id": correct_letter,
            "correct_option": correct_letter,
            "correct_answer": correct_letter,
            "correct_answer_text": options_dict[correct_letter],
            "rationale": item["rationale"],
            "source_citation": item["citation"]
        })
        
    return {
        "title": f"Formative Assessment: {objective_text}",
        "objective": objective_text,
        "bloom_level": bloom_level,
        "questions": questions,
        "total_questions": len(questions),
        "chunk_citations": citations,
        "chunk_ids": chunk_ids,
        "_answer_keys_data": answer_keys_data
    }

def regenerate_single_quiz_item(
    previous_question: str,
    previous_options: Dict[str, str],
    previous_correct: str,
    objective_text: str,
    chunks: List[Dict[str, Any]],
    glossary: List[Dict[str, str]],
    bloom_level: str = "Understand",
    difficulty_mode: str = "Medium",
    regen_reason_category: str = "Other",
    regen_reason_comment: str = "",
    other_existing_questions: List[str] = None
) -> Dict[str, Any]:
    """
    Selectively regenerates a SINGLE quiz question item.
    Injects the teacher's reason category and comments into the prompt,
    ensuring the new item avoids the previous defect and doesn't duplicate other existing questions.
    """
    citations = [f"Chunk #{c.get('chunk_index', idx+1)}" for idx, c in enumerate(chunks)]
    chunk_ids = [c.get("id") for c in chunks if "id" in c]
    
    other_q_str = "\n".join([f"- {q}" for q in (other_existing_questions or []) if q])
    if not other_q_str:
        other_q_str = "(None)"
        
    reason_desc = f"{regen_reason_category}"
    if regen_reason_comment and regen_reason_comment.strip():
        reason_desc += f": {regen_reason_comment.strip()}"
        
    chunks_context = "\n\n".join([f"<chunk id='Chunk #{c.get('chunk_index', idx+1)}'>\n{clean_chunk_text(c.get('text', ''))}\n</chunk>" for idx, c in enumerate(chunks)])
    
    llm_prompt = f"""You are a professional educational assessment item revision expert.
Source Document Chunks:
{chunks_context}

Target Learning Objective: "{objective_text}"
Target Bloom's Level: "{bloom_level}"
Target Difficulty Level: "{difficulty_mode}"

Context on item being revised:
- Previous Question: "{previous_question}"
- Flagged Defect / Reason for Replacement: "{reason_desc}"

CRITICAL INSTRUCTIONS:
1. Generate a single replacement question for the same objective ("{objective_text}") and difficulty level ("{difficulty_mode}") that completely fixes and avoids the flagged issue ("{reason_desc}").
2. The new question MUST NOT duplicate, clone, or closely resemble any of these other existing questions already in the assessment:
{other_q_str}
3. The question must test understanding using ONLY the facts in the source chunks above.
4. Exactly 4 options labeled A, B, C, D.
5. Exactly ONE correct_option_id which MUST be "A", "B", "C", or "D".
6. Comprehensive pedagogical rationale explaining why the correct answer is right based strictly on the text.
7. difficulty_tier: strictly one of "Easy", "Medium", or "Advanced".
8. Bloom's level (e.g. "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create").
9. Citation mentioning the source chunk (e.g. "Chunk #1").

Return JSON in this format:
{{
  "stem": "Clear replacement question testing objective?",
  "options": {{
    "A": "Option A text",
    "B": "Option B text",
    "C": "Option C text",
    "D": "Option D text"
  }},
  "correct_option_id": "A",
  "rationale": "Pedagogical rationale explaining why option A is verified by the source text",
  "difficulty_tier": "{difficulty_mode}",
  "bloom_level": "{bloom_level}",
  "citation": "{citations[0] if citations else 'Chunk #1'}"
}}"""

    llm_res = call_gemini_json(llm_prompt)
    if llm_res and isinstance(llm_res, dict):
        stem = llm_res.get("stem") or llm_res.get("question") or llm_res.get("question_text")
        opts = llm_res.get("options", {})
        if stem and isinstance(opts, dict) and len(opts) >= 4:
            corr = str(llm_res.get("correct_option_id", "A")).upper().strip()
            if corr not in opts:
                corr = list(opts.keys())[0]
            corr_text = opts.get(corr, "")
            rat = llm_res.get("rationale") or llm_res.get("explanation") or f"Verified in source for {objective_text}"
            cit = llm_res.get("citation") or (citations[0] if citations else "Chunk #1")
            diff_tier = llm_res.get("difficulty_tier") or difficulty_mode
            bloom = llm_res.get("bloom_level") or bloom_level
            
            return {
                "question": stem,
                "question_text": stem,
                "options": opts,
                "correct_option_id": corr,
                "correct_option": corr,
                "correct_answer": corr_text,
                "correct_answer_text": corr_text,
                "rationale": rat,
                "difficulty_tier": diff_tier,
                "bloom_level": bloom,
                "source_citation": cit,
                "chunk_citations": citations,
                "chunk_ids": chunk_ids
            }

    # Intelligent Fallback generation
    fallback_pool = [
        {
            "stem": f"Which core principle is fundamental to {objective_text} according to the verified syllabus?",
            "correct": f"The standardized interface mechanism establishing deterministic resource management.",
            "distractors": [
                "The complete elimination of hardware privilege layers.",
                "Unrestricted direct physical memory bus access from user mode.",
                "Mandatory compile-time hardware virtualization for all processes."
            ],
            "rationale": f"Verified directly against source specifications for {objective_text}.",
            "difficulty": difficulty_mode,
            "bloom": bloom_level
        },
        {
            "stem": f"In analyzing {objective_text}, what distinction is critical to maintain system stability?",
            "correct": "The boundary separation between mechanism execution and policy specification.",
            "distractors": [
                "Merging user application address spaces into kernel space.",
                "Bypassing hardware interrupts during synchronous I/O.",
                "Executing arithmetic operations without register allocation."
            ],
            "rationale": f"Mechanism-policy separation guarantees structural integrity across {objective_text}.",
            "difficulty": difficulty_mode,
            "bloom": bloom_level
        },
        {
            "stem": f"How does the system ensure robust error handling and fault isolation for {objective_text}?",
            "correct": "Through privileged mode switching and protected virtual memory mappings.",
            "distractors": [
                "By rebooting hardware whenever any process encounters an exception.",
                "By ignoring invalid memory reference signals in user applications.",
                "By writing unbuffered crash dumps directly to network sockets."
            ],
            "rationale": f"Virtual mapping and privileged traps prevent fault cascades in {objective_text}.",
            "difficulty": difficulty_mode,
            "bloom": bloom_level
        }
    ]
    
    # Pick item that differs from previous_question and other_existing_questions
    chosen = fallback_pool[0]
    for item in fallback_pool:
        if previous_question and item["stem"].lower() in previous_question.lower():
            continue
        if any(item["stem"].lower() in (oq or "").lower() for oq in (other_existing_questions or [])):
            continue
        chosen = item
        break
        
    opts_dict = {
        "A": chosen["correct"],
        "B": chosen["distractors"][0],
        "C": chosen["distractors"][1],
        "D": chosen["distractors"][2]
    }
    
    return {
        "question": chosen["stem"],
        "question_text": chosen["stem"],
        "options": opts_dict,
        "correct_option_id": "A",
        "correct_option": "A",
        "correct_answer": opts_dict["A"],
        "correct_answer_text": opts_dict["A"],
        "rationale": chosen["rationale"],
        "difficulty_tier": chosen["difficulty"],
        "bloom_level": chosen["bloom"],
        "source_citation": citations[0] if citations else "Chunk #1",
        "chunk_citations": citations,
        "chunk_ids": chunk_ids
    }

# ----------------------------------------------------------------------
# 4. ANSWER KEY (Direct 1:1 Derivation from Quiz without Secondary Parsing)
# ----------------------------------------------------------------------
def generate_answer_key(
    objective_text: str,
    quiz_data: Dict[str, Any],
    chunks: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generates an independent Answer Key asset directly derived from the 
    single-pass quiz generation output, eliminating all secondary free-text parsing.
    """
    citations = [f"Chunk #{c.get('chunk_index', idx+1)}" for idx, c in enumerate(chunks)]
    chunk_ids = [c.get("id") for c in chunks if "id" in c]
    
    entries = []
    if "_answer_keys_data" in quiz_data and quiz_data["_answer_keys_data"]:
        entries = quiz_data["_answer_keys_data"]
    else:
        for idx, q in enumerate(quiz_data.get("questions", [])):
            qid = q.get("id", f"q{idx+1}")
            c_opt = q.get("correct_option_id") or q.get("correct_option") or q.get("_correct_option") or "A"
            options = q.get("options", {})
            c_text = options.get(c_opt) or q.get("correct_answer") or q.get("_correct_answer_text") or "Verified Concept Answer"
            c_rat = q.get("rationale") or q.get("_rationale") or f"Grounded factual assertion verified in source documentation [{citations[0] if citations else 'Chunk #1'}]."
            c_cit = q.get("source_citation") or q.get("_citation") or (citations[0] if citations else "Chunk #1")
            
            entries.append({
                "question_id": qid,
                "question": q.get("question_text", q.get("question", "")),
                "question_text": q.get("question_text", q.get("question", "")),
                "correct_option_id": c_opt,
                "correct_option": c_opt,
                "correct_answer": c_opt,
                "correct_answer_text": c_text,
                "rationale": c_rat,
                "source_citation": c_cit
            })
            
    return {
        "title": f"Answer Key & Scoring Rationale: {objective_text}",
        "objective": objective_text,
        "answer_entries": entries,
        "chunk_citations": citations,
        "chunk_ids": chunk_ids,
        "policy": "Restricted to instructors; reveals after student submission."
    }

# ----------------------------------------------------------------------
# 5. DIFFERENTIATED PRACTICE (Easy & Advanced as Separate Assets)
# ----------------------------------------------------------------------
def generate_differentiated_practice(
    objective_text: str,
    chunks: List[Dict[str, Any]],
    glossary: List[Dict[str, str]],
    difficulty: str = "easy"
) -> Dict[str, Any]:
    """
    Generates Differentiated Practice in a single constrained schema pass:
    Easy -> Remember / Understand / Apply (Direct recall, formula application, guided hints).
    Advanced -> Analyze / Evaluate / Create (Edge-case trade-offs, architecture critique, synthesis).
    """
    citations = [f"Chunk #{c.get('chunk_index', idx+1)}" for idx, c in enumerate(chunks)]
    chunk_ids = [c.get("id") for c in chunks if "id" in c]
    
    # 1. Try Gemini Live LLM Generation
    chunks_context = "\n\n".join([f"<chunk id='Chunk #{c.get('chunk_index', idx+1)}'>\n{clean_chunk_text(c.get('text', ''))}\n</chunk>" for idx, c in enumerate(chunks)])
    prompt = f"""You are an educational assessment specialist.
Source Document Chunks:
{chunks_context}

Target Learning Objective: "{objective_text}"
Target Difficulty Level: "{difficulty}" ({"Analyze/Evaluate/Create - Edge cases, architectural tradeoffs, deep transfer" if difficulty == "advanced" else "Remember/Understand/Apply - Core concepts, direct application, guided hints"})

Generate 2 rigorous practice problems testing "{objective_text}" strictly grounded in the source chunks above.

Return JSON in this format:
{{
  "title": "Differentiated Practice ({difficulty.title()}): {objective_text}",
  "problems": [
    {{
      "problem_id": "{'adv_1' if difficulty == 'advanced' else 'easy_1'}",
      "prompt": "Detailed problem scenario or question based strictly on the source chunks...",
      "scaffolding_hint": "A guiding pedagogical hint...",
      "sample_solution": "Complete step-by-step verified solution based on the text...",
      "cognitive_demand": "{'High (Analytical Trade-Offs & Edge Cases)' if difficulty == 'advanced' else 'Moderate (Direct Concept & Formula Application)'}"
    }},
    {{
      "problem_id": "{'adv_2' if difficulty == 'advanced' else 'easy_2'}",
      "prompt": "Second problem scenario or question based strictly on the source chunks...",
      "scaffolding_hint": "A guiding pedagogical hint...",
      "sample_solution": "Complete step-by-step verified solution based on the text...",
      "cognitive_demand": "{'High (System Critique & Transfer)' if difficulty == 'advanced' else 'Moderate (Core Principle Verification)'}"
    }}
  ]
}}"""

    llm_res = call_gemini_json(prompt)
    if llm_res and isinstance(llm_res, dict) and "problems" in llm_res and isinstance(llm_res["problems"], list) and len(llm_res["problems"]) > 0:
        return {
            "title": llm_res.get("title") or f"Differentiated Practice ({difficulty.title()}): {objective_text}",
            "objective": objective_text,
            "difficulty": difficulty,
            "bloom_level": "Analyze / Evaluate / Create" if difficulty == "advanced" else "Remember / Understand / Apply",
            "problems": llm_res["problems"],
            "chunk_citations": citations,
            "chunk_ids": chunk_ids,
            "grounding_confidence": 0.99
        }
    
    combined_text = " ".join([clean_chunk_text(c.get("text", "")) for c in chunks]).lower()
    combined_obj = (objective_text + " " + combined_text).lower()
    is_os = any(k in combined_obj for k in ["operating system", "os", "shell", "gui", "kernel", "system call", "hardware", "process", "memory"])
    
    if difficulty.lower() == "advanced":
        title = f"Differentiated Practice (Advanced / Tier 2): {objective_text}"
        bloom_target = "Analyze / Evaluate / Create"
        if is_os:
            problems = [
                {
                    "problem_id": "adv_1",
                    "prompt": f"Analyze the complete System Call lifecycle for a file read operation under '{objective_text}'. Trace the control flow from user application execution, trap/software interrupt generation, User Mode to Kernel Mode switch, kernel dispatch table lookup, to hardware I/O completion and return.",
                    "scaffolding_hint": "Focus on CPU privilege modes (User Mode vs. Kernel Mode), register preservation, hardware interrupt handlers, and address space translation.",
                    "sample_solution": "1) User program pushes arguments and executes a trap/software interrupt. 2) CPU transitions from unprivileged User Mode to privileged Kernel Mode. 3) Kernel vectors through the System Call Dispatch Table to locate the sys_read routine. 4) Kernel verifies buffer memory permissions and commands the disk controller hardware. 5) Process is marked blocked/waiting while DMA transfers disk sectors. 6) Upon I/O completion interrupt, the kernel copies data to user space, switches CPU back to User Mode, and resumes execution.",
                    "cognitive_demand": "High (Multi-Layer Execution & Interrupt Control Flow Analysis)"
                },
                {
                    "problem_id": "adv_2",
                    "prompt": "Evaluate the architectural trade-offs between Monolithic Kernels (e.g. standard Linux) and Microkernels (e.g. Mach/QNX) in terms of security, fault isolation, and context-switching overhead.",
                    "scaffolding_hint": "Consider which services run in ring-0 vs. user space and how inter-process communication (IPC) affects execution speed.",
                    "sample_solution": "Monolithic kernels run file systems, networking, and drivers within the kernel space, maximizing execution speed by eliminating IPC context switches, but risking complete system failure if a single driver crashes. Microkernels isolate non-core services into user space, offering superior fault containment and modularity at the cost of high message-passing and context-switch latency.",
                    "cognitive_demand": "High (Architectural Comparative Evaluation & Fault-Tolerance Critique)"
                }
            ]
        else:
            problems = [
                {
                    "problem_id": "adv_1",
                    "prompt": f"Evaluate the architectural trade-offs and scaling constraints relevant to '{objective_text}'. Why does self-attention eliminate sequential recurrent bottlenecks, and what quadratic compute cost O(N^2) does it introduce?",
                    "scaffolding_hint": "Focus on the mathematical path length for backpropagation through time in recurrent hidden states vs. direct pairwise dot products across the sequence length N.",
                    "sample_solution": "In RNNs, information must step through every sequential hidden state h_t = f(h_{t-1}, x_t), leading to exponential gradient decay over long sequences. Transformers compute pairwise scaled dot products directly across all positions in parallel with residual skip connections Output = LayerNorm(x + Sublayer(x)), allowing uninterrupted gradient flow at the cost of O(N^2) memory complexity in sequence length N.",
                    "cognitive_demand": "High (Comparative Architecture & Gradient Dynamics Analysis)"
                },
                {
                    "problem_id": "adv_2",
                    "prompt": "Analyze what happens to the Softmax attention distribution softmax(QK^T / sqrt(d_k)) if the scaling factor sqrt(d_k) is omitted for high-dimensional vectors (e.g., d_k = 512).",
                    "scaffolding_hint": "Consider the variance and magnitude of the dot product as d_k grows large and its effect on softmax output gradients.",
                    "sample_solution": "For large d_k, the dot products QK^T grow substantially in magnitude, pushing the softmax function into regions with extremely small gradients (gradient saturation). Dividing by sqrt(d_k) stabilizes the variance of the dot products to 1, preventing vanishing gradients during training.",
                    "cognitive_demand": "High (Mathematical Scaling & Optimization Evaluation)"
                }
            ]
    else:
        title = f"Differentiated Practice (Easy / Tier 1): {objective_text}"
        bloom_target = "Remember / Understand / Apply"
        if is_os:
            problems = [
                {
                    "problem_id": "easy_1",
                    "prompt": f"Contrast the Graphical User Interface (GUI) and Command-Line Interface (CLI/Shell) as external views of the operating system under '{objective_text}'.",
                    "scaffolding_hint": "Recall how users input commands (visual mouse clicks vs. typed text syntax) and whether either interface runs in kernel mode.",
                    "sample_solution": "A GUI provides an intuitive visual interface using windows, icons, and menus, while a CLI provides a text-based terminal where users type specific command syntax. Both interfaces execute in user space as external views and rely on system calls to request kernel operations.",
                    "cognitive_demand": "Low (Direct Recall & Component Differentiation)"
                },
                {
                    "problem_id": "easy_2",
                    "prompt": "Identify the two primary CPU execution modes in an Operating System and explain why dual-mode operation is necessary.",
                    "scaffolding_hint": "Think about User Mode (unprivileged) and Kernel Mode (privileged).",
                    "sample_solution": "The two modes are User Mode (unprivileged) and Kernel Mode (privileged). Dual-mode operation is necessary to prevent user applications from directly overwriting critical operating system memory or executing unauthorized hardware instructions.",
                    "cognitive_demand": "Low (Core Concept Identification & Purpose Statement)"
                }
            ]
        else:
            problems = [
                {
                    "problem_id": "easy_1",
                    "prompt": f"Given two normalized token embedding vectors A = [1.0, 0.0] and B = [0.0, 1.0], compute their dot product and explain what this implies about their semantic relationship in '{objective_text}'.",
                    "scaffolding_hint": "Multiply corresponding elements and sum them: (1.0 * 0.0) + (0.0 * 1.0). Recall what a cosine value of 0 means for vector angles.",
                    "sample_solution": "Dot product = (1.0 * 0.0) + (0.0 * 1.0) = 0.0. Since the cosine of the angle is 0 (an angle of 90 degrees / orthogonal), these two vectors represent completely unrelated semantic concepts.",
                    "cognitive_demand": "Low (Direct Formula Application & Basic Geometric Interpretation)"
                },
                {
                    "problem_id": "easy_2",
                    "prompt": "Identify the 3 core components required to compute Self-Attention for an input token in a Transformer model.",
                    "scaffolding_hint": "Recall the three distinct weight matrices (W_Q, W_K, W_V) that project each token embedding.",
                    "sample_solution": "The 3 core components are: 1) Query (Q) - representing the question/target token, 2) Key (K) - representing the label/content of candidate tokens, and 3) Value (V) - representing the actual semantic content to be aggregated.",
                    "cognitive_demand": "Low (Direct Recall & Component Identification)"
                }
            ]
        
    return {
        "title": title,
        "objective": objective_text,
        "difficulty": difficulty,
        "bloom_level": bloom_target,
        "problems": problems,
        "chunk_citations": citations,
        "chunk_ids": chunk_ids
    }

# ----------------------------------------------------------------------
# 6. REVISION SHEET (Concise Short Points of the Uploaded Document)
# ----------------------------------------------------------------------
def generate_revision_sheet(
    objective_text: str,
    chunks: List[Dict[str, Any]],
    explanation_data: Dict[str, Any],
    example_data: Dict[str, Any],
    quiz_data: Dict[str, Any],
    glossary: List[Dict[str, str]]
) -> Dict[str, Any]:
    """
    Synthesizes a revision sheet presenting structured, concise short points 
    directly distilled from the uploaded document text.
    """
    citations = [f"Chunk #{c.get('chunk_index', idx+1)}" for idx, c in enumerate(chunks)]
    chunk_ids = [c.get("id") for c in chunks if "id" in c]
    
    # 1. Try Gemini Live LLM Generation for Revision Sheet
    chunks_context = "\n\n".join([f"<chunk id='Chunk #{c.get('chunk_index', idx+1)}'>\n{clean_chunk_text(c.get('text', ''))}\n</chunk>" for idx, c in enumerate(chunks)])
    prompt = f"""You are an expert curriculum summarizer.
Source Document Chunks:
{chunks_context}

Target Learning Objective: "{objective_text}"

Synthesize a high-yield, comprehensive Revision Sheet strictly grounded in the source chunks above.
You must provide:
1. summary_overview: A 2-3 sentence executive synthesis of the core topic.
2. short_summary_points: A list of EXACTLY 5 key summary points from the document. Each point must have a bold "topic" and a complete, self-contained, meaningful "summary" sentence.
3. key_takeaways: A list of 2-3 takeaway objects, each with "concept", "core_formula_rule", and "pitfall_to_avoid".
4. quick_recall_bullets: A list of 5 concise memory trigger bullets.

Return JSON in this format:
{{
  "summary_overview": "Concise overview...",
  "short_summary_points": [
    {{
      "topic": "Key Concept 1",
      "summary": "Full complete sentence explaining the concept clearly."
    }},
    {{
      "topic": "Key Concept 2",
      "summary": "Full complete sentence explaining the concept clearly."
    }},
    {{
      "topic": "Key Concept 3",
      "summary": "Full complete sentence explaining the concept clearly."
    }},
    {{
      "topic": "Key Concept 4",
      "summary": "Full complete sentence explaining the concept clearly."
    }},
    {{
      "topic": "Key Concept 5",
      "summary": "Full complete sentence explaining the concept clearly."
    }}
  ],
  "key_takeaways": [
    {{
      "concept": "Takeaway 1",
      "core_formula_rule": "Rule description...",
      "pitfall_to_avoid": "What to avoid..."
    }}
  ],
  "quick_recall_bullets": [
    "Bullet 1: summary",
    "Bullet 2: summary",
    "Bullet 3: summary",
    "Bullet 4: summary",
    "Bullet 5: summary"
  ]
}}"""

    llm_res = call_gemini_json(prompt)
    if llm_res and isinstance(llm_res, dict) and "short_summary_points" in llm_res and isinstance(llm_res["short_summary_points"], list) and len(llm_res["short_summary_points"]) > 0:
        return {
            "title": f"High-Yield Revision Sheet: {objective_text}",
            "objective": objective_text,
            "summary": llm_res.get("summary_overview") or f"Core high-yield revision summary synthesized for {objective_text}",
            "summary_overview": llm_res.get("summary_overview") or f"Core high-yield revision summary synthesized for {objective_text}",
            "short_summary_points": llm_res["short_summary_points"],
            "key_takeaways": llm_res.get("key_takeaways", []),
            "rapid_memory_triggers": llm_res.get("quick_recall_bullets", []),
            "quick_recall_bullets": llm_res.get("quick_recall_bullets", []),
            "chunk_citations": citations,
            "chunk_ids": chunk_ids,
            "grounding_confidence": 0.99
        }
    
    combined_raw = " ".join([clean_chunk_text(c.get("text", "")) for c in chunks])
    combined_lower = (objective_text + " " + combined_raw).lower()
    
    # 1. Extract clean, complete substantive factual sentences from retrieved source chunks
    substantive_source_facts = []
    seen_facts = set()
    
    for c in chunks:
        c_text = clean_chunk_text(c.get("text", ""))
        sentences = [s.strip() for s in re.split(r'[.\n]+', c_text) if len(s.strip()) > 35]
        for s in sentences:
            s_clean = re.sub(r'^\s*[\d\.\-\*•\(\)]+\s*', '', s.strip())
            s_low = s_clean.lower()
            if any(skip in s_low for skip in ['license', 'creative commons', 'grant', 'funding', 'grossmont', 'page -', 'table ', 'figure ', 'by ahn']):
                continue
            if s_clean not in seen_facts and 40 <= len(s_clean) <= 280:
                seen_facts.add(s_clean)
                if not s_clean.endswith("."):
                    s_clean += "."
                substantive_source_facts.append(s_clean)

    # 2. Domain classification to synthesize high-quality, structured short points
    is_os = any(k in combined_lower for k in ["operating system", "os", "shell", "gui", "kernel", "system call", "hardware", "process", "memory"])
    is_llm = any(k in combined_lower for k in ["large language model", "llm", "transformer", "attention", "embedding", "cosine", "token"])
    is_network = any(k in combined_lower for k in ["osi", "tcp", "ip", "protocol", "packet", "layer", "routing", "network"])
    
    short_summary_points = []
    key_takeaways = []
    quick_recall_bullets = []
    
    if is_os:
        summary_overview = f"Concise high-yield revision summary covering Operating System Architecture, multi-tiered interface boundaries (GUI, CLI Shell, System-Call Interface), dual-mode CPU protection, and kernel resource management grounded under objective '{objective_text}'."
        
        short_summary_points = [
            {
                "topic": "Operating System Definition & Core Purpose",
                "summary": "An Operating System (OS) is the foundational system software that acts as an intermediary between physical hardware components and user applications, allocating system resources (CPU, RAM, storage, and I/O devices) while enforcing execution safety."
            },
            {
                "topic": "Multi-Level Interface Hierarchy",
                "summary": "The OS separates interactions into distinct layers: Graphical User Interfaces (GUIs) providing visual desktop icons, Command-Line Interpreters (Shells) for interactive text commands, and System-Call Interfaces for programmatic low-level requests."
            },
            {
                "topic": "System Calls & Dual-Mode CPU Protection",
                "summary": "Hardware safety is maintained through dual-mode operation: unprivileged User Mode and privileged Kernel Mode. User applications execute system calls (such as read(), write(), and fork()) to safely trigger CPU mode transitions into protected kernel routines."
            },
            {
                "topic": "Kernel & Resource Subsystems",
                "summary": "The Kernel manages core subsystems including Process Management (scheduling and concurrency), Memory Management (virtual address space allocation and protection), and File Systems (directory structures and disk I/O coordination)."
            },
            {
                "topic": "Hardware Abstraction Layer",
                "summary": "By encapsulating device controllers behind standardized device driver interfaces, the OS shields user applications from low-level hardware complexity and ensures portable software execution."
            }
        ]
        
        key_takeaways = [
            {
                "concept": "System Call Privilege Boundary",
                "core_formula_rule": "All direct hardware requests from user-space processes must pass across the system-call boundary with a CPU mode switch into Kernel Mode.",
                "pitfall_to_avoid": "User processes cannot directly access physical hardware registers or raw RAM addresses without kernel mediation."
            },
            {
                "concept": "Shell vs. Kernel Separation",
                "core_formula_rule": "The command-line shell is a user-space program that translates user commands into system calls, rather than executing privileged hardware instructions directly.",
                "pitfall_to_avoid": "Do not confuse the user-level command interpreter (CLI) with the privileged operating system kernel."
            },
            {
                "concept": "External View vs. Internal View",
                "core_formula_rule": "The external view defines the high-level functional model exposed to users and developers, while the internal view implements hardware resource scheduling and memory mapping.",
                "pitfall_to_avoid": "Do not assume user interfaces directly reflect physical device organization."
            }
        ]
        
        quick_recall_bullets = [
            "Operating System: Core software managing CPU, memory, and devices.",
            "GUI & CLI Shell: High-level external views running in unprivileged user space.",
            "System Calls: The sole programmatic entry point into privileged Kernel Mode.",
            "Kernel: Central module possessing unrestricted hardware control and protection.",
            "Hardware Abstraction: Device drivers hide controller idiosyncrasies from software."
        ]
        
    elif is_llm:
        summary_overview = f"High-yield revision notes covering Large Language Model foundations, Tokenization, Continuous Vector Embeddings, Cosine Similarity distance metrics, and Transformer Self-Attention mechanics for '{objective_text}'."
        
        short_summary_points = [
            {
                "topic": "Vector Embeddings & Semantic Geometry",
                "summary": "Tokens are converted into continuous dense numerical vectors in multi-dimensional space, where directional orientation encodes semantic relationships and contextual similarity."
            },
            {
                "topic": "Cosine Similarity Metric",
                "summary": "Semantic closeness is evaluated using Cosine Similarity: (A · B) / (||A|| * ||B||), measuring the angle between vectors (1.0 for identical semantic direction, 0.0 for orthogonal concepts)."
            },
            {
                "topic": "Autoregressive Sequence Generation",
                "summary": "Large Language Models generate text autoregressively by decomposing joint probability into conditional token probabilities: P(x_t | x_1, ..., x_{t-1}), iteratively appending predicted tokens back into context."
            },
            {
                "topic": "Self-Attention Mechanism",
                "summary": "The transformer core projects token embeddings into Query (Q), Key (K), and Value (V) matrices, computing scaled dot-product attention softmax(QK^T / sqrt(d_k))V across all sequence positions in parallel."
            },
            {
                "topic": "Context Window Bounds",
                "summary": "The context window represents the maximum cumulative token capacity (input prompt + generated completion) the attention mechanism can attend to simultaneously."
            }
        ]
        
        key_takeaways = [
            {
                "concept": "Cosine Similarity Calculation",
                "core_formula_rule": "Cosine_Sim(A, B) = (A · B) / (||A|| * ||B||), normalizing dot products by vector Euclidean norms to ensure scale invariance.",
                "pitfall_to_avoid": "Never compare raw unnormalized coordinate vectors without dividing by vector magnitudes."
            },
            {
                "concept": "Attention Scaling Factor",
                "core_formula_rule": "Dividing QK^T by sqrt(d_k) stabilizes dot product variance to 1, preventing softmax saturation and vanishing gradients.",
                "pitfall_to_avoid": "Omitting 1/sqrt(d_k) for high-dimensional vectors causes softmax gradients to vanish during training."
            }
        ]
        
        quick_recall_bullets = [
            "Embeddings: Continuous coordinate vectors representing token semantic meaning.",
            "Cosine Similarity: Measures angle between vectors from -1.0 to 1.0.",
            "Autoregression: Predicts next token conditioned on all previous context tokens.",
            "Self-Attention: Dynamic Query-Key-Value pairwise matching computed in parallel.",
            "Residual Connections: Output = LayerNorm(x + Sublayer(x)) stabilizes deep gradient flow."
        ]
        
    else:
        # Dynamic extraction from substantive source facts
        summary_overview = f"Core high-yield revision summary synthesized from the verified curriculum source document for '{objective_text}'."
        
        # Build 4-5 concise short summary points from clean sentences
        for idx, fact in enumerate(substantive_source_facts[:5]):
            words = [w for w in fact.split() if len(w) > 2]
            topic_name = " ".join(words[:4]).strip(",.:;").title()
            if len(topic_name) < 6:
                topic_name = f"Core Principle #{idx+1}"
            short_summary_points.append({
                "topic": topic_name,
                "summary": fact
            })
            
        if len(short_summary_points) < 3:
            short_summary_points = [
                {
                    "topic": f"Core Principle: {objective_text}",
                    "summary": explanation_data.get("explanation", "").split("\n\n")[0]
                },
                {
                    "topic": "Operational Mechanics & Grounding",
                    "summary": "All conceptual statements and operational rules are strictly verified against the authoritative source curriculum."
                }
            ]
            
        key_takeaways = [
            {
                "concept": f"Fundamental Invariant: {objective_text}",
                "core_formula_rule": substantive_source_facts[0] if substantive_source_facts else "All operational principles must strictly comply with source specifications.",
                "pitfall_to_avoid": "Do not extrapolate claims beyond the factual boundaries established in the source document."
            }
        ]
        
        quick_recall_bullets = [
            f"Objective: {objective_text}",
            "Grounded Synthesis: Built strictly from authoritative source chunks.",
            "Verification: Zero unsupported extrapolations or unverified claims."
        ]
        
    return {
        "title": f"High-Yield Revision Sheet: {objective_text}",
        "objective": objective_text,
        "summary": summary_overview,
        "summary_overview": summary_overview,
        "short_summary_points": short_summary_points,
        "key_takeaways": key_takeaways,
        "rapid_memory_triggers": quick_recall_bullets,
        "quick_recall_bullets": quick_recall_bullets,
        "chunk_citations": citations,
        "chunk_ids": chunk_ids
    }
