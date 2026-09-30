# Retrievo (formerly LessonFoundry) — Technical Architecture & Project Specification
**EduGenAI Track · Generative AI Domain · Comprehensive System Documentation**

> **Design Theme**: Royal Obsidian (`#050608`) with Neon Orange (`#ff6200` / `#ffa600`) & Glassmorphism  
> **Backend Architecture**: FastAPI (Python 3.11) + PostgreSQL 16 (Relational Schema) + Google Gemini API + YOLOv8 Vision  
> **Frontend Architecture**: React 18 + Vite + Tailwind CSS + Lucide Icons  
> **Core Principle**: 100% Relational Persistence — Zero mock data, strict chunk provenance, automated guardrails, and teacher-in-the-loop telemetry  

---

## 1. Executive Summary & Problem Statement

Traditional generative AI in educational settings suffers from critical, systemic failure modes:
1. **Hallucination & Confident Invention**: Commercial LLMs invent plausible-sounding pedagogical facts when source documents have knowledge gaps.
2. **Loss of Provenance**: Study packs, quizzes, and revision guides rarely cite specific textbook sentences or source chunks, leaving educators unable to verify grounding without manual line-by-line checks.
3. **Unguarded Generation Quality**: Raw LLM output frequently contains answer leakage in question stems, duplicate questions, answer key mismatches, and cognitive difficulty miscalibrations.
4. **Lack of Continuous Diagnostic Telemetry**: Instructors lack fine-grained, question-level insight into which distractors mislead students and which learning objectives require intervention.
5. **Integrity Risks in Online Testing**: Unguarded online assessments suffer from cheating, unauthorized devices, and absence from testing stations.

**Retrievo** solves these challenges by providing an end-to-end, teacher-controlled studio that transforms **authoritative source material** into grounded, syllabus-aligned learning packs backed by **sentence-level chunk citations**, **automated quality guardrails**, **pre-generation coverage gap detection**, **real-time AI proctoring**, and **diagnostic assessment telemetry**.

---

## 2. Platform Architecture

```mermaid
flowchart TD
    subgraph UI ["Client Layer (React 18 + Vite + Tailwind CSS)"]
        TeacherUI["Teacher Studio & Classroom Manager"]
        StudentUI["Student Portal & Proctored Exam Player"]
        AdminUI["Admin Approval & Audit Console"]
        TelemetryUI["Assessment Results & Diagnostic Telemetry"]
    end

    subgraph BackendLayer ["Application Layer (FastAPI + Python 3.11)"]
        Router["FastAPI REST API & JWT Security"]
        DocIngest["Layout-Aware Ingestion & OpenCV Image Preprocessing"]
        CoverageEngine["Source Coverage Auditor (TF-IDF + Gemini)"]
        ValidationEngine["Teacher Input Validation Layer"]
        RAGEngine["Grounded RAG Engine (<source_chunk> XML Sandbox)"]
        GuardrailsEngine["6 Automated Quality Guardrails"]
        ProctorEngine["Real-Time YOLOv8 Vision Proctoring"]
        TelemetryEngine["Question-Level Diagnostic Telemetry Engine"]
    end

    subgraph AI ["AI & Computer Vision"]
        GeminiFlash["Google Gemini 2.5/1.5 Flash (Generation & Reasoning)"]
        GeminiVision["Gemini Vision API (Multimodal OCR & Handwriting Extraction)"]
        YOLOv8["YOLOv8 Object Detection (Person, Phone, Laptop Proctoring)"]
    end

    subgraph Storage ["Persistence Layer (PostgreSQL 16)"]
        PG_Users["users & classrooms & enrollments"]
        PG_Docs["sources & source_versions & chunks & source_pages"]
        PG_Units["units & objectives & glossary"]
        PG_Assets["assets & asset_versions (with chunk provenance)"]
        PG_Flags["quality_flags & validation_flags"]
        PG_Requests["student_requests & request_responses"]
        PG_Submissions["assignments & submissions & telemetry"]
    end

    UI -->|REST / Bearer JWT| Router
    Router --> DocIngest
    Router --> CoverageEngine
    Router --> ValidationEngine
    Router --> RAGEngine
    Router --> GuardrailsEngine
    Router --> ProctorEngine
    Router --> TelemetryEngine

    DocIngest --> GeminiVision
    CoverageEngine --> GeminiFlash
    ValidationEngine --> GeminiFlash
    RAGEngine --> GeminiFlash
    GuardrailsEngine --> GeminiFlash
    ProctorEngine --> YOLOv8

    BackendLayer -->|SQLAlchemy ORM| Storage
```

---

## 3. Key Modules & Technical Capabilities

### 3.1 Grounded Curriculum & RAG Generation Studio
- **Layout-Aware PDF & Notes Ingestion**: Ingests textbook PDFs, scanned notes, and OCR transcripts with image preprocessing (adaptive thresholding, deskewing, contrast enhancement).
- **Semantic Chunker**: Implements 300–600 token windowing with 15% sliding overlap and deterministic chunk indexing.
- **XML Tag Sandboxed Injection**: retrieved source text is enclosed in `<source_chunk id="..." page="...">` tags to prevent prompt injection attacks.
- **5 Pedagogical Generators**:
  1. *Concept Explanation*: Step-by-step conceptual deconstruction with `[Chunk #N]` citations.
  2. *Worked Example*: Derivations with explicit sub-step justifications.
  3. *Formative Quiz*: 4-option multiple-choice items with distractor rationales and explanation keys.
  4. *Differentiated Practice*: Easy tier (Recall/Understand) and Advanced tier (Analyze/Evaluate).
  5. *High-Yield Revision Sheet*: Quick-review flash summaries, formulas, and canonical definitions.

### 3.2 Automated Quality Guardrails
Enforces 6 automated pre-approval quality checks:
1. **Duplicate / Near-Identical Questions**: N-gram token overlap & `SequenceMatcher` ratio $> 0.78$ between question stems.
2. **Answer Leakage in Question Stem**: Regex & substring search detecting correct answer disclosure in the prompt.
3. **Answer Key Mismatch**: Verifies designated answer key exactly matches one of the 4 option choices.
4. **Unsupported Claims**: Sentence-to-chunk token mapping against retrieved source excerpts.
5. **Missing Objective Coverage**: Validates generated item mapping against unit learning objective contracts.
6. **Cognitive Difficulty Calibration**: Compares target Bloom level vs cognitive demand of questions.

### 3.3 Assessment Results & Diagnostic Telemetry
- **Participation Telemetry (Did vs. Didn't)**: Graphical dual-color progress bar displaying **Did (Attempted) [Yes]** vs. **Didn't (Pending) [No]** completion breakdown, class average scores, and mastery buckets.
- **Question-by-Question Telemetry with Click-Only Expand Accordion Boxes**:
  - Collapsed by default showing question number, objective tag, difficulty tier, and Did vs. Didn't accuracy bars.
  - **Expands only on click** to reveal:
    - Full question prompt.
    - Verified correct key with rationale.
    - Option choice distribution bar chart (A, B, C, D) with student counts and percentages.
    - Common distractor misconception trap alerts.
    - Pedagogical rationale and solution explanations.
    - Individual student response breakdown matrix.
- **Student Submissions Roster & Submission Inspector**:
  - Filterable by *All*, *Did (Yes)*, and *Didn't (No)*.
  - Interactive "Inspect Answers" modal to audit individual student performance question-by-question.

### 3.4 Real-Time AI Vision Proctoring (YOLOv8)
- Real-time webcam proctoring during assessments.
- High-frequency visual inference detecting:
  - Absence of student from testing area.
  - Multiple persons detected in frame.
  - Unauthorized cell phone or secondary laptop presence.
- Automatically logs infractions and maintains examination integrity.

### 3.5 Student Credential Generator & Classroom Routing
- **Unique Credential Generator**: Automatic generation of independent student credentials with secure random passwords (`LF-XXXXXX`), CSV export, and single-click clipboard copying.
- **Unique 6-Character Join Codes**: Secure classroom enrollment routing with teacher join permission queues.
- **Student Help & Course Notes Request Inbox**: In-portal help tickets tagged to learning objectives with teacher resolution workflows (supporting text responses and PDF course note attachments).

---

## 4. Technology Stack

| Layer | Technology | Key Usage |
|---|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons | Responsive glassmorphism interface, interactive telemetry accordions, proctored quiz runner |
| **Backend** | FastAPI (Python 3.11), Pydantic v2, Uvicorn | Asynchronous REST API, schema validation, auth middleware |
| **Database** | PostgreSQL 16, SQLAlchemy ORM, psycopg2-binary | 100% relational schema, ACID transactions, foreign-key integrity |
| **AI / LLM** | Google Gemini (2.5-Flash / 1.5-Flash), Gemini Vision | Curriculum generation, source coverage auditing, multimodal OCR |
| **Computer Vision** | YOLOv8 (Ultralytics), OpenCV | Proctoring multi-object detection, image deskewing and OCR preprocessing |
| **Document Export** | ReportLab 4.x | Vectorized, printable learning pack PDF generation with provenance tags |

---

## 5. End-to-End Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Educator
    participant Frontend as React Client
    participant API as FastAPI Backend
    participant AI as Gemini & YOLOv8
    participant DB as PostgreSQL 16
    actor Student as Student

    Teacher->>Frontend: Uploads Textbook / Notes & Creates Unit
    Frontend->>API: POST /api/teacher/units/upload-and-create
    API->>AI: Gemini Vision OCR & Semantic Chunker
    API->>DB: Persists Source, SourcePages, and Chunks
    
    Teacher->>Frontend: Generates Grounded Learning Pack
    Frontend->>API: POST /api/teacher/units/{id}/generate-pack
    API->>AI: Gemini Flash with <source_chunk> Sandboxing
    API->>API: Executes 6 Automated Quality Guardrails
    API->>DB: Stores AssetVersion with [Chunk #N] citations
    
    Teacher->>Frontend: Assigns Assessment to Classroom
    Frontend->>API: POST /api/teacher/assignments/create
    API->>DB: Creates Assignment records

    Student->>Frontend: Takes Assessment with YOLOv8 Webcam Proctoring
    Frontend->>API: POST /api/student/proctor/verify-frame (Streaming)
    API->>AI: YOLOv8 detects person/device anomalies
    Student->>Frontend: Submits Final Assessment
    Frontend->>API: POST /api/student/assignments/submit
    API->>DB: Stores Submission & computes score
    
    Teacher->>Frontend: Views Assessment Results & Telemetry
    Frontend->>API: GET /api/teacher/classrooms/{id}/assessment-telemetry
    API-->>Frontend: Returns Did vs. Didn't participation, Question Accordions, Distractor Analytics
```

---

## 6. Quickstart & Installation Guide

### Prerequisites
- **Python 3.11+**
- **Node.js 18+ & npm**
- **PostgreSQL 16** (running on `localhost:5432` with database `lessonfoundry`)
- **Google Gemini API Key**

---

### Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate a Python virtual environment (optional but recommended)
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables in backend/.env
# Example .env:
# GEMINI_API_KEY="your-gemini-api-key"
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lessonfoundry"
# JWT_SECRET="your-jwt-secret-key"

# 5. Start FastAPI server
python -m uvicorn app.main:app --reload --port 8000
```
*Interactive Swagger API documentation is available at `http://localhost:8000/docs`.*

---

### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install npm dependencies
npm install

# 3. Start Vite dev server
npm run dev
```
*Frontend application will be accessible at `http://localhost:5173`.*

---

## 7. Default Seeded Credentials

| Role | Username / Email | Password | Access Level |
|---|---|---|---|
| **System Admin** | `admin@lessonfoundry.com` | `Admin@12345` | Global audit log, teacher approvals, system monitoring |
| **Approved Teacher** | `dr.sharma@university.edu` | `Teacher@12345` | Full Studio, RAG generator, Telemetry, Classroom manager |
| **Pending Teacher** | `pending.prof@college.edu` | `Teacher@12345` | Awaiting admin verification |
| **Enrolled Student** | `kumar@retrievo.edu` | `LF-KUMAR1` | Enrolled in classroom, proctored assessments, help requests |

---

## 8. Git Branching & Repository

- **Repository**: [`https://github.com/Prasanna11-22/edugen-ai.git`](https://github.com/Prasanna11-22/edugen-ai.git)
- **Primary Branches**:
  - `pradeep` (Default branch with all merged features)
  - `feat/classroom-validation-updates` (Assessment telemetry, proctoring, credential generator)
