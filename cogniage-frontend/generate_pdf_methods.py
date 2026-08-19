import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)

def generate_pdf(filename="Biometric_Age_Prediction_Languages_and_Methods_Guide.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Color Palette
    royal_blue = colors.HexColor("#1a4cd2")
    dark_navy = colors.HexColor("#0b2b80")
    light_blue = colors.HexColor("#eef3ff")
    text_dark = colors.HexColor("#0f172a")
    text_muted = colors.HexColor("#475569")
    border_gray = colors.HexColor("#cbd5e1")
    code_bg = colors.HexColor("#f1f5f9")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=dark_navy,
        spaceAfter=3
    )

    badge_style = ParagraphStyle(
        'BadgeStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=royal_blue,
        spaceAfter=4
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=text_muted,
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=royal_blue,
        spaceBefore=10,
        spaceAfter=4
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=dark_navy,
        spaceBefore=7,
        spaceAfter=3
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=text_dark,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=text_dark,
        leftIndent=10,
        spaceAfter=2.5
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10.5,
        textColor=dark_navy
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=dark_navy
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=text_dark
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=royal_blue
    )

    story = []

    # Document Header Banner
    story.append(Paragraph("TECHNICAL SPECIFICATION & METHODOLOGY MANUAL", badge_style))
    story.append(Paragraph("Biometric Age Prediction — Languages & Methods Guide", title_style))
    story.append(Paragraph("<b>System:</b> Real-Time Computer Vision & Explainable AI (XAI) &nbsp;|&nbsp; <b>Author:</b> Frontend Engineering Team", meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=royal_blue, spaceAfter=8))

    # SECTION 1: LANGUAGES & WEB STANDARDS USED
    story.append(Paragraph("1. Core Languages & Web Technologies (Top-to-Bottom)", h1_style))
    story.append(Paragraph(
        "The application is engineered without third-party framework overhead, leveraging standard web standards for maximum execution speed, zero installation requirements, and 60 FPS hardware acceleration:",
        body_style
    ))

    lang_data = [
        [Paragraph("Technology", table_header), Paragraph("Standard / Version", table_header), Paragraph("Key Features Utilized", table_header), Paragraph("Role in Project", table_header)],
        [Paragraph("HTML5", table_cell_bold), Paragraph("W3C HTML5 Recommendation", table_cell), Paragraph("Semantic tags, <code>&lt;video&gt;</code>, <code>&lt;canvas&gt;</code>, <code>&lt;input type='file'&gt;</code>, ARIA dialogs", table_cell), Paragraph("Provides document structure, multimedia stream bindings, and accessible modal overlays.", table_cell)],
        [Paragraph("Vanilla CSS3", table_cell_bold), Paragraph("CSS Level 3 / Custom Properties", table_cell), Paragraph("CSS Variables, CSS Grid, Flexbox, Keyframes, <code>transform: scaleX(-1)</code>", table_cell), Paragraph("Controls the Royal Blue & White theme, hardware-accelerated animations, and responsive layouts.", table_cell)],
        [Paragraph("Vanilla JavaScript", table_cell_bold), Paragraph("ECMAScript 2022 (ES6+)", table_cell), Paragraph("Promises, async/await, arrow functions, modules, destructuring", table_cell), Paragraph("Implements client-side application logic, vision processing loop, and UI event controllers.", table_cell)],
        [Paragraph("Web MediaDevices API", table_cell_bold), Paragraph("W3C Media Capture Streams", table_cell), Paragraph("<code>navigator.mediaDevices.getUserMedia()</code>", table_cell), Paragraph("Captures hardware webcam video feed with user constraints (1280x720 ideal resolution).", table_cell)],
        [Paragraph("HTML5 Canvas 2D API", table_cell_bold), Paragraph("W3C 2D Context API", table_cell), Paragraph("<code>CanvasRenderingContext2D</code> paths, strokes, transforms, text", table_cell), Paragraph("Draws real-time polygon wireframe, cyber brackets, and floating age badge below face at 60 FPS.", table_cell)],
        [Paragraph("Google MediaPipe", table_cell_bold), Paragraph("FaceMesh v0.4 (Wasm/WebGL)", table_cell), Paragraph("468 3D facial landmark regression model", table_cell), Paragraph("Client-side neural network tracking facial coordinates directly inside the browser.", table_cell)],
        [Paragraph("HTML5 File API", table_cell_bold), Paragraph("W3C File API", table_cell), Paragraph("<code>FileReader.readAsDataURL()</code>", table_cell), Paragraph("Decodes local image uploads into base64 data for photo-mode age prediction.", table_cell)],
        [Paragraph("Web Storage API", table_cell_bold), Paragraph("W3C Web Storage", table_cell), Paragraph("<code>window.localStorage</code>", table_cell), Paragraph("Persists Light / Dark theme selection across browser sessions.", table_cell)]
    ]

    lang_table = Table(lang_data, colWidths=[85, 105, 160, 190])
    lang_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), light_blue),
        ('GRID', (0, 0), (-1, -1), 0.5, border_gray),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")])
    ]))
    story.append(lang_table)

    # SECTION 2: MATHEMATICAL & ALGORITHMIC METHODS
    story.append(Paragraph("2. Mathematical, Algorithmic & Computer Vision Methods", h1_style))
    
    story.append(Paragraph("<b>A. Exponential Moving Average (EMA) Smoothing Algorithm:</b>", body_style))
    story.append(Paragraph(
        "Raw webcam landmark coordinates often suffer from high-frequency hardware noise (jitter). "
        "The system applies an Exponential Moving Average filter on each frame: "
        "<i>P_smoothed(t) = &alpha; &middot; P_raw(t) + (1 - &alpha;) &middot; P_smoothed(t-1)</i> (where &alpha; = 0.45), "
        "guaranteeing buttery-smooth box and landmark movement at 60 FPS.",
        bullet_style
    ))

    story.append(Paragraph("<b>B. Geometric Landmark Normalization & Mirror Compensation:</b>", body_style))
    story.append(Paragraph(
        "Because front-facing cameras are naturally mirrored via CSS (<code>transform: scaleX(-1)</code>), "
        "the JavaScript coordinates undergo horizontal inversion mapping: "
        "<i>X_canvas = (1.0 - X_norm) &times; Width_canvas</i> and <i>Y_canvas = Y_norm &times; Height_canvas</i>.",
        bullet_style
    ))

    story.append(Paragraph("<b>C. Delaunay-Style Facial Triangulation Topology:</b>", body_style))
    story.append(Paragraph(
        "The 31 key anatomical nodes are mapped into polygon facets (forehead hexagon, orbital triangles, nasal bridge, nasolabial lines, and chin contour) "
        "strictly <b>inside the facial boundary</b>, reflecting standard craniofacial anthropometry.",
        bullet_style
    ))

    story.append(Paragraph("<b>D. Explainable AI (XAI) Biological Reasoning:</b>", body_style))
    story.append(Paragraph(
        "Instead of returning an opaque prediction, the system segments the face into 4 biological aging zones: "
        "(1) Periocular/Canthal lines, (2) Nasolabial sulcus prominence, (3) Forehead skin texture smoothness, and (4) Mandibular contour firmness.",
        bullet_style
    ))

    # SECTION 3: DETAILED FUNCTION-BY-FUNCTION REFERENCE
    story.append(Paragraph("3. Exhaustive Codebase Methods & Functions (Top-to-Bottom)", h1_style))

    methods_data = [
        [Paragraph("Function Name", table_header), Paragraph("Parameters", table_header), Paragraph("Description & Execution Workflow", table_header)],
        [Paragraph("<code>initTheme()</code>", table_cell_bold), Paragraph("None", table_cell), Paragraph("Reads saved theme preference from <code>localStorage</code> (defaults to 'light') and sets up click listener on toggle button.", table_cell)],
        [Paragraph("<code>applyTheme(t)</code>", table_cell_bold), Paragraph("<code>t (string: 'light'|'dark')</code>", table_cell), Paragraph("Applies <code>data-theme</code> attribute on <code>&lt;html&gt;</code> element and updates theme text and sun/moon icon.", table_cell)],
        [Paragraph("<code>initFaceMesh()</code>", table_cell_bold), Paragraph("None", table_cell), Paragraph("Instantiates Google MediaPipe <code>FaceMesh</code> instance, configures tracking confidence (0.5), and registers callback.", table_cell)],
        [Paragraph("<code>onFaceMeshResults(res)</code>", table_cell_bold), Paragraph("<code>results (Object)</code>", table_cell), Paragraph("Primary vision callback. Extracts 468 landmark points, calculates bounding box extremes, applies EMA smoothing, triggers canvas rendering, and updates UI status.", table_cell)],
        [Paragraph("<code>drawRealFaceMesh()</code>", table_cell_bold), Paragraph("<code>box, pts, age, conf</code>", table_cell), Paragraph("Renders yellow polygon wireframe lines, square landmark nodes, cyan corner bounding box, and the floating age badge 12px strictly below the face.", table_cell)],
        [Paragraph("<code>drawRoundedRect()</code>", table_cell_bold), Paragraph("<code>ctx, x, y, w, h, r</code>", table_cell), Paragraph("Mathematical helper using quadratic Bezier curves (<code>quadraticCurveTo</code>) to render smooth rounded HUD badges.", table_cell)],
        [Paragraph("<code>startCamera()</code>", table_cell_bold), Paragraph("None (async)", table_cell), Paragraph("Requests camera permissions via <code>getUserMedia</code>, binds stream to <code>&lt;video&gt;</code>, synchronizes canvas, and starts the processing loop.", table_cell)],
        [Paragraph("<code>stopCamera()</code>", table_cell_bold), Paragraph("None", table_cell), Paragraph("Iterates over active media stream tracks and calls <code>track.stop()</code>, clears canvas, and restores standby screen.", table_cell)],
        [Paragraph("<code>toggleFreeze()</code>", table_cell_bold), Paragraph("None", table_cell), Paragraph("Pauses/resumes the real-time frame processing loop for visual inspection and grading.", table_cell)],
        [Paragraph("<code>handleImageUpload(f)</code>", table_cell_bold), Paragraph("<code>file (File Object)</code>", table_cell), Paragraph("Uses <code>FileReader</code> to read local user photo, halts live camera, and switches application into 'Photo Mode'.", table_cell)],
        [Paragraph("<code>renderUploadedPhoto()</code>", table_cell_bold), Paragraph("<code>img (Image Object)</code>", table_cell), Paragraph("Calculates aspect-ratio fit, centers image on canvas, detects face boundaries, and overlays biometric mesh and age tag.", table_cell)],
        [Paragraph("<code>updateExplainabilityReason()</code>", table_cell_bold), Paragraph("<code>age, customReason</code>", table_cell), Paragraph("Generates dynamic textual rationale explaining why the model predicted that specific age based on the 4 biological facial markers.", table_cell)],
        [Paragraph("<code>openXaiModal() / closeXaiModal()</code>", table_cell_bold), Paragraph("None", table_cell), Paragraph("Controls visibility and popup animations of the Explainable AI (XAI) modal dialog.", table_cell)],
        [Paragraph("<code>startContinuousProcessing()</code>", table_cell_bold), Paragraph("None (async)", table_cell), Paragraph("60 FPS non-blocking animation loop using <code>requestAnimationFrame</code> that passes video frames to MediaPipe.", table_cell)],
        [Paragraph("<code>runFallbackDetection()</code>", table_cell_bold), Paragraph("<code>timestamp (DOMHighRes)</code>", table_cell), Paragraph("Offline fallback simulator that ensures face tracking runs seamlessly even in environments without internet access.", table_cell)]
    ]

    methods_table = Table(methods_data, colWidths=[140, 110, 290])
    methods_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), light_blue),
        ('GRID', (0, 0), (-1, -1), 0.5, border_gray),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")])
    ]))
    story.append(methods_table)

    # SECTION 4: ARCHITECTURAL JUSTIFICATION (VIVA & INTERVIEW PREP)
    story.append(Paragraph("4. Architectural Justification & Interview Q&A", h1_style))
    story.append(Paragraph("<b>Q: Why Vanilla HTML/CSS/JS instead of React or Vue?</b>", body_style))
    story.append(Paragraph(
        "<i>Answer:</i> Vanilla JS runs natively in any browser with zero compilation or installation steps. "
        "React introduces virtual DOM overhead that adds unnecessary latency when updating 60 FPS canvas coordinates. "
        "Vanilla JS provides direct, raw access to the GPU-accelerated Canvas 2D API.",
        bullet_style
    ))
    story.append(Paragraph("<b>Q: Why client-side MediaPipe instead of sending video to Python OpenCV backend?</b>", body_style))
    story.append(Paragraph(
        "<i>Answer:</i> Sending 60 frames per second over HTTP/WebSocket creates massive network bandwidth bottlenecks and latency. "
        "Executing face detection on the client via WebAssembly/WebGL gives instant 60 FPS feedback with 0ms network lag.",
        bullet_style
    ))
    story.append(Paragraph("<b>Q: How is the backend integrated?</b>", body_style))
    story.append(Paragraph(
        "<i>Answer:</i> The architecture is decoupled. When the Python PyTorch/FastAPI backend is ready, the frontend simply makes a single "
        "<code>POST /api/predict-age</code> request with the captured facial frame, and updates the age badge and explanation modal dynamically.",
        bullet_style
    ))

    # Build PDF
    doc.build(story)
    print("PDF generated successfully:", filename)

if __name__ == "__main__":
    generate_pdf()
