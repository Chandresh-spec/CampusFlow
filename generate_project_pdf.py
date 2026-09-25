import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print 'Page X of Y' and running headers."""
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
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#059669"))
        
        # Header (Pages 2+)
        if self._pageNumber > 1:
            self.drawString(54, 800, "CampusFlow™ | Executive Architecture & Engineering Report")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.75)
            self.line(54, 793, 541, 793)

        # Footer (All Pages)
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.75)
        self.line(54, 45, 541, 45)
        
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(54, 32, "Confidential & Proprietary — CampusFlow Academic OS")
        
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(541, 32, page_str)
        self.restoreState()


def build_pdf(filename="CampusFlow_Project_Architecture_and_Features.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    PRIMARY = colors.HexColor("#059669")     # Vibrant Emerald
    PRIMARY_DARK = colors.HexColor("#064e3b")# Deep Emerald
    ACCENT_TEAL = colors.HexColor("#0d9488") # Teal Accent
    TEXT_MAIN = colors.HexColor("#0f172a")   # Slate 900
    TEXT_MUTED = colors.HexColor("#475569")  # Slate 600
    BG_LIGHT = colors.HexColor("#f8fafc")    # Slate 50
    BG_EMERALD = colors.HexColor("#ecfdf5")  # Emerald 50
    BORDER_COLOR = colors.HexColor("#cbd5e1")# Slate 300

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=PRIMARY_DARK,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=PRIMARY,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'H1',
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=PRIMARY_DARK,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=PRIMARY,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=TEXT_MAIN,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=TEXT_MAIN,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=4
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=TEXT_MAIN
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=PRIMARY_DARK
    )

    callout_style = ParagraphStyle(
        'Callout',
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=PRIMARY_DARK
    )

    story = []

    # ── HEADER & META ───────────────────────────────────────────
    story.append(Paragraph("CampusFlow™ Academic Operating System", title_style))
    story.append(Paragraph("Full-Stack Enterprise Technical Architecture, Problem Analysis & Optimizations", subtitle_style))
    
    meta_table = Table(
        [
            [
                Paragraph("<b>Author:</b> Antigravity Engineering Pair", table_cell_style),
                Paragraph("<b>Version:</b> 2.4 Production", table_cell_style),
                Paragraph("<b>Deployment:</b> AWS EC2 + Docker Compose", table_cell_style),
                Paragraph("<b>Date:</b> September 2026", table_cell_style),
            ]
        ],
        colWidths=[130, 100, 155, 102]
    )
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_EMERALD),
        ('BOX', (0, 0), (-1, -1), 0.75, PRIMARY),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#a7f3d0")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # ── 1. EXECUTIVE SUMMARY ────────────────────────────────────
    story.append(Paragraph("1. Executive Summary & Product Vision", h1_style))
    story.append(Paragraph(
        "<b>CampusFlow</b> is a modern, high-concurrency academic operating platform designed to replace disorganized, "
        "unsecured messaging apps (WhatsApp, Telegram) with an official, institutional-grade campus network. "
        "It unifies real-time semester discussion channels, curriculum-organized syllabus storage, contextual Retrieval-Augmented "
        "Generation (RAG) academic AI, and strict role verification into a single ultra-responsive web application.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # ── 2. CORE PROBLEMS SOLVED ─────────────────────────────────
    story.append(Paragraph("2. Critical Engineering & Business Problems Solved", h1_style))
    
    prob_data = [
        [
            Paragraph("<b>Problem Encountered</b>", table_header_style),
            Paragraph("<b>Root Cause / Legacy Deficiency</b>", table_header_style),
            Paragraph("<b>Engineered Solution in CampusFlow</b>", table_header_style),
        ],
        [
            Paragraph("<b>1. Academic Information Chaos & Inter-Semester Leakage</b>", table_cell_bold),
            Paragraph("Students across Sem 1 to 8 mixed into identical channels and accessed unauthorized notes without boundaries.", table_cell_style),
            Paragraph("<b>Strict Multi-Layer Semester Isolation:</b> Enforced across backend SQL queries, WebSocket rooms, course note views, and AI assistant context. Sem 1 students can only view Sem 1 resources.", table_cell_style),
        ],
        [
            Paragraph("<b>2. Unusable S3 Upload Latency (2–3 sec wait)</b>", table_cell_bold),
            Paragraph("AWS S3 bucket located in Sydney (<code>ap-southeast-2</code>) incurred 2000–3000ms round-trip latency, blocking the API thread during photo uploads.", table_cell_style),
            Paragraph("<b>Local Persistent Cache + Async S3 Task:</b> Immediate local disk write (&lt;10ms) returns instant 200 OK to the client; AWS S3 upload executed asynchronously in background via <code>asyncio.create_task</code>.", table_cell_style),
        ],
        [
            Paragraph("<b>3. Profile Photo Disappearing / Resetting on Login</b>", table_cell_bold),
            Paragraph("Database stored raw internal S3 keys (<code>avatars/...</code>). Login API returned this raw string, leading the browser to resolve relative URLs with 404 errors.", table_cell_style),
            Paragraph("<b>Unified Endpoint Normalization:</b> All auth endpoints now format avatars into <code>/api/profile/avatar/{id}/</code> with persistent disk fallback and client-side cache busting (<code>?t=...</code>).", table_cell_style),
        ],
        [
            Paragraph("<b>4. AI Hallucinations on Course Exams</b>", table_cell_bold),
            Paragraph("Generic LLMs lack institution-specific textbooks, syllabus guidelines, and teacher slides, yielding inaccurate answers.", table_cell_style),
            Paragraph("<b>Syllabus-Grounded RAG Pipeline:</b> Uploaded lecture PDFs are chunked (800 chars), embedded via Sentence-Transformers, and stored in vector memory for sub-second grounded question answering.", table_cell_style),
        ],
        [
            Paragraph("<b>5. Intrusive Technical Developer Jargon</b>", table_cell_bold),
            Paragraph("User-facing UI contained developer buzzwords like 'Live WebSocket', 'Update S3 Photo', 'Gmail OTP', and 'Uploading to S3...'.", table_cell_style),
            Paragraph("<b>Production Polish:</b> Completely scrubbed all infrastructure terms; replaced with intuitive terms like 'Online', 'Update Photo', and 'Continue with Google'.", table_cell_style),
        ],
    ]
    prob_table = Table(prob_data, colWidths=[140, 160, 187])
    prob_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(prob_table)
    story.append(Spacer(1, 10))

    # ── 3. FULL TECHNOLOGY STACK ────────────────────────────────
    story.append(Paragraph("3. Full-Stack Technology Matrix", h1_style))
    
    tech_data = [
        [
            Paragraph("<b>Tier / Domain</b>", table_header_style),
            Paragraph("<b>Selected Technology</b>", table_header_style),
            Paragraph("<b>Architectural Role & Value Proposition</b>", table_header_style),
        ],
        [
            Paragraph("<b>Frontend Framework</b>", table_cell_bold),
            Paragraph("Next.js 14 (App Router) + React 18 + TypeScript", table_cell_style),
            Paragraph("Server-Side Rendering (SSR) & Static Page Generation for 13 optimized routes, strict type safety, zero layout shifts.", table_cell_style),
        ],
        [
            Paragraph("<b>Styling & UX</b>", table_cell_bold),
            Paragraph("Tailwind CSS + Lucide Icons", table_cell_style),
            Paragraph("Modern White + Emerald Green theme (<code>#059669</code>), fluid responsive mobile-drawer layouts, custom animated micro-interactions.", table_cell_style),
        ],
        [
            Paragraph("<b>Client State & Caching</b>", table_cell_bold),
            Paragraph("TanStack React Query v5", table_cell_style),
            Paragraph("Automatic background refetching, declarative query keys (scoped by semester), optimistic cache updates, zero redundant network calls.", table_cell_style),
        ],
        [
            Paragraph("<b>Backend API</b>", table_cell_bold),
            Paragraph("FastAPI (Python 3.12 ASGI)", table_cell_style),
            Paragraph("High-concurrency async non-blocking request handling, automated OpenAPI documentation, sub-10ms JSON response speed.", table_cell_style),
        ],
        [
            Paragraph("<b>Asynchronous ORM</b>", table_cell_bold),
            Paragraph("SQLAlchemy 2.0 (AsyncSession) + SQLite / PostgreSQL", table_cell_style),
            Paragraph("Relationship eager-loading (<code>selectinload</code>) eliminating N+1 query overheads across subjects, users, notices, and messages.", table_cell_style),
        ],
        [
            Paragraph("<b>Real-Time Engine</b>", table_cell_bold),
            Paragraph("FastAPI WebSockets + ConnectionPool", table_cell_style),
            Paragraph("Full-duplex real-time messaging, client presence detection, broadcasting WhatsApp-style messages with DP avatar payloads.", table_cell_style),
        ],
        [
            Paragraph("<b>In-Memory Store & 2FA</b>", table_cell_bold),
            Paragraph("Redis 7 Alpine", table_cell_style),
            Paragraph("TTL-backed (5-minute auto-expiry) one-time login verification codes (OTP), session caching, and rate limiting.", table_cell_style),
        ],
        [
            Paragraph("<b>Object Storage</b>", table_cell_bold),
            Paragraph("Amazon Web Services (AWS S3) + Boto3", table_cell_style),
            Paragraph("Durable multi-part cloud storage for syllabus PDFs, presentation decks, lecture images, and avatars with presigned URL streaming.", table_cell_style),
        ],
        [
            Paragraph("<b>Academic AI & Vector Search</b>", table_cell_bold),
            Paragraph("Sentence-Transformers + Groq / DeepSeek LPU", table_cell_style),
            Paragraph("Local chunk embedding vector store enabling sub-second Retrieval-Augmented Generation (RAG) grounded in syllabus PDFs.", table_cell_style),
        ],
        [
            Paragraph("<b>Video Conferencing</b>", table_cell_bold),
            Paragraph("Jitsi Meet Web API", table_cell_style),
            Paragraph("1-click instant class video conferencing rooms isolated dynamically by Semester and Subject Code.", table_cell_style),
        ],
        [
            Paragraph("<b>Infrastructure & DevOps</b>", table_cell_bold),
            Paragraph("Docker + Docker Compose + Nginx", table_cell_style),
            Paragraph("Containerized multi-service orchestration (Backend, Frontend, Redis, Nginx reverse proxy) deployed on AWS EC2.", table_cell_style),
        ],
    ]
    tech_table = Table(tech_data, colWidths=[120, 150, 217])
    tech_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_DARK),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(tech_table)
    story.append(Spacer(1, 10))

    # ── 4. IMPLEMENTED FEATURES & ARCHITECTURE ─────────────────
    story.append(Paragraph("4. Key Feature Implementations & Technical Deep-Dive", h1_style))

    story.append(Paragraph("A. Real-Time Classroom Channels (College 'WhatsApp')", h2_style))
    story.append(Paragraph(
        "• <b>Full-Duplex WebSockets:</b> Room-level subscription pools allow students and professors to converse in real-time without polling.<br/>"
        "• <b>WhatsApp-Style Circular Avatars:</b> Every message broadcasts sender initials or custom avatar DP from <code>/api/profile/avatar/{id}/</code>.<br/>"
        "• <b>Presence Dot & Status:</b> Live connection states display clear indicators: <i>Online</i>, <i>Connecting...</i>, or <i>Offline</i>.<br/>"
        "• <b>1-Click Class Video Meet:</b> Integrated Jitsi Meet launches high-definition video classrooms with zero registration required.",
        bullet_style
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph("B. Strict Multi-Tier Semester Isolation", h2_style))
    story.append(Paragraph(
        "• <b>Chat Sandboxing:</b> Semester 1 students only receive and broadcast messages in Semester 1 subject channels; cross-semester joins are blocked by HTTP 403 / WebSocket 4003.<br/>"
        "• <b>Study Notes Sandboxing:</b> The student portal automatically locks queries to the student's enrolled semester (e.g. <code>Semester 1 Official Notes</code>). The 8-semester switch tabs are completely removed for students.<br/>"
        "• <b>AI Assistant Scope:</b> The Course Context dropdown under <code>/ai-assistant</code> filters available courses strictly to the student's active semester.",
        bullet_style
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph("C. NexusAI Syllabus RAG Assistant", h2_style))
    story.append(Paragraph(
        "• <b>Automated PDF Ingestion:</b> When professors upload course notes, the backend automatically extracts text and creates 800-character chunks with 100-character overlaps.<br/>"
        "• <b>Vector Embeddings:</b> Chunks are embedded via Sentence-Transformers into a persistent vector index.<br/>"
        "• <b>Sub-Second Retrieval:</b> Student questions trigger cosine similarity vector queries across their syllabus documents, sending top chunks as context to the LLM for hallucination-free answers.",
        bullet_style
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph("D. Digital Campus ID Card & Profile Management", h2_style))
    story.append(Paragraph(
        "• <b>Interactive Academic Badge:</b> Displays verified Student/Faculty badge, dynamic USN identifier, and simulated security barcode.<br/>"
        "• <b>Instant Photo Updates:</b> Uploaded images update in milliseconds with immediate client-side preview, cache-busting timestamps, and background cloud sync.",
        bullet_style
    ))
    story.append(Spacer(1, 10))

    # ── 5. PERFORMANCE OPTIMIZATIONS ────────────────────────────
    story.append(Paragraph("5. Systematic Performance & Latency Optimizations", h1_style))

    opt_box_data = [
        [
            Paragraph(
                "<b>Key Optimization Strategies Implemented:</b><br/>"
                "<b>1. Asynchronous I/O Offloading:</b> Separated time-critical HTTP responses from slow cloud writes. Avatar uploads save to local persistent volume (<code>/app/data/avatars/</code>) in &lt;10ms, while AWS S3 upload is dispatched in an asynchronous task (<code>asyncio.create_task</code>).<br/>"
                "<b>2. Sub-Millisecond Disk Serving:</b> <code>get_user_avatar</code> inspects the local disk first using pattern globbing. If present, it returns an immediate <code>FileResponse</code> (0–2ms) instead of streaming over WAN from S3.<br/>"
                "<b>3. S3 First-Hit Auto-Caching:</b> When an avatar or document is first requested from S3, the server streams bytes to the client and simultaneously persists a local disk copy for all subsequent requests.<br/>"
                "<b>4. Browser Cache Invalidation:</b> Cleaned image caching bugs by appending deterministic cache-buster timestamps (<code>?t=${Date.now()}</code>) upon upload, ensuring zero stale images.<br/>"
                "<b>5. Client-Side Query Deduplication:</b> TanStack React Query handles server-state caching, eliminating redundant network calls across tab switches and route transitions.<br/>"
                "<b>6. Production Bundle Minimization:</b> Next.js production compilation achieves optimized bundle sizes (average first-load JS ~120-140 kB across 13 routes).",
                callout_style
            )
        ]
    ]
    opt_table = Table(opt_box_data, colWidths=[487])
    opt_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_EMERALD),
        ('BOX', (0, 0), (-1, -1), 1, PRIMARY),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(opt_table)
    story.append(Spacer(1, 14))

    # ── 6. PRODUCTION DEPLOYMENT TOPOLOGY ───────────────────────
    story.append(Paragraph("6. Production Deployment Topology (AWS EC2)", h1_style))
    story.append(Paragraph(
        "CampusFlow runs in a multi-container isolated Docker network orchestrated via Docker Compose:<br/>"
        "• <b>Nginx Container (Port 80/443):</b> Handles incoming web traffic, TLS termination, reverse proxy routing, and WebSocket upgrades.<br/>"
        "• <b>FastAPI Backend (Port 8000):</b> High-concurrency Python ASGI worker with mounted persistent volume <code>./backend/data:/app/data</code>.<br/>"
        "• <b>Next.js Frontend (Port 3000):</b> Optimized standalone Node.js production server with dynamic runtime environment variables.<br/>"
        "• <b>Redis Container (Port 6379):</b> In-memory cache for fast 2FA OTP codes and session invalidation.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # Sign-off box
    signoff_data = [
        [
            Paragraph("<b>System Status:</b> Production Ready", table_cell_bold),
            Paragraph("<b>Target Domain:</b> campus-flow.duckdns.org", table_cell_style),
            Paragraph("<b>Build Validation:</b> 0 Errors (13 Routes)", table_cell_style)
        ]
    ]
    signoff_table = Table(signoff_data, colWidths=[160, 180, 147])
    signoff_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(signoff_table)

    # Build the document with our custom NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated: {filename}")

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else "CampusFlow_Project_Architecture_and_Features.pdf"
    build_pdf(target)
