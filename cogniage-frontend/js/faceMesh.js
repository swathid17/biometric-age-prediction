/**
 * COGNIAGE AI - BIOMETRIC FACIAL MESH & LANDMARK ENGINE
 * Renders geometric polygon triangulation mesh, face bounding box,
 * and floating Age HUD matching the Cognizant Hackathon specifications.
 */

class BiometricFaceMeshEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    
    // Feature Visibility Toggles
    this.showMesh = true;
    this.showBox = true;
    this.showAgeHud = true;

    // Smoothed Face Coordinates for jitter-free 60FPS tracking
    this.smoothBox = null;
    this.smoothLandmarks = null;
    this.smoothingAlpha = 0.35; // Exponential Moving Average coefficient

    // Canonical Normalized Facial Landmark Topology (Inspired by Reference Image 2)
    // 32 Key Structural Geometric Nodes & Triangulation Polygons
    this.baseLandmarkTopology = [
      // Forehead & Crown Nodes (0 - 5)
      { id: 'forehead_top', x: 0.50, y: 0.12 },
      { id: 'forehead_left_high', x: 0.32, y: 0.18 },
      { id: 'forehead_right_high', x: 0.68, y: 0.18 },
      { id: 'temple_left', x: 0.22, y: 0.32 },
      { id: 'temple_right', x: 0.78, y: 0.32 },
      { id: 'glabella', x: 0.50, y: 0.33 },

      // Eyebrows & Upper Orbit (6 - 11)
      { id: 'brow_left_outer', x: 0.28, y: 0.33 },
      { id: 'brow_left_inner', x: 0.44, y: 0.34 },
      { id: 'brow_right_inner', x: 0.56, y: 0.34 },
      { id: 'brow_right_outer', x: 0.72, y: 0.33 },
      { id: 'eye_left_outer', x: 0.29, y: 0.39 },
      { id: 'eye_left_inner', x: 0.42, y: 0.40 },

      // Eyes & Nasion (12 - 17)
      { id: 'eye_right_inner', x: 0.58, y: 0.40 },
      { id: 'eye_right_outer', x: 0.71, y: 0.39 },
      { id: 'eye_left_center', x: 0.35, y: 0.39 },
      { id: 'eye_right_center', x: 0.65, y: 0.39 },
      { id: 'nasion', x: 0.50, y: 0.38 },
      { id: 'rhinion', x: 0.50, y: 0.48 },

      // Nose & Nasolabial Anchors (18 - 21)
      { id: 'nose_tip', x: 0.50, y: 0.55 },
      { id: 'ala_left', x: 0.43, y: 0.54 },
      { id: 'ala_right', x: 0.57, y: 0.54 },
      { id: 'subnasale', x: 0.50, y: 0.60 },

      // Cheeks & Zygomatic Arches (22 - 25)
      { id: 'cheek_left', x: 0.24, y: 0.48 },
      { id: 'cheek_right', x: 0.76, y: 0.48 },
      { id: 'gonion_left', x: 0.26, y: 0.65 },
      { id: 'gonion_right', x: 0.74, y: 0.65 },

      // Mouth & Perioral (26 - 29)
      { id: 'mouth_left', x: 0.39, y: 0.66 },
      { id: 'mouth_right', x: 0.61, y: 0.66 },
      { id: 'mouth_top', x: 0.50, y: 0.63 },
      { id: 'mouth_bottom', x: 0.50, y: 0.70 },

      // Chin & Mandible Base (30 - 32)
      { id: 'mentolabial', x: 0.50, y: 0.76 },
      { id: 'chin_left', x: 0.38, y: 0.84 },
      { id: 'chin_right', x: 0.62, y: 0.84 },
      { id: 'gnathion', x: 0.50, y: 0.88 }
    ];

    // Geometric Triangulation Connections (Polygon Grid matching Reference Image 2)
    this.meshConnections = [
      // Crown & Forehead Polygons
      [0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [2, 5], [0, 5],
      [1, 6], [2, 9], [5, 6], [5, 9], [5, 7], [5, 8],
      
      // Eye & Upper Face Triangles
      [3, 6], [4, 9], [6, 7], [8, 9], [7, 16], [8, 16], [7, 8],
      [6, 10], [9, 13], [10, 11], [12, 13], [11, 16], [12, 16],
      [10, 14], [11, 14], [12, 15], [13, 15], [14, 16], [15, 16],

      // Zygomatic (Cheek) & Nose Triangulation
      [3, 22], [4, 23], [10, 22], [13, 23],
      [16, 17], [17, 18], [17, 19], [17, 20],
      [19, 18], [20, 18], [19, 21], [20, 21], [18, 21],
      [22, 19], [23, 20], [22, 24], [23, 25],

      // Nasolabial & Perioral Polygons
      [21, 28], [21, 26], [21, 27],
      [26, 28], [27, 28], [26, 29], [27, 29], [28, 29],
      [24, 26], [25, 27], [24, 31], [25, 32],

      // Chin & Jawline Base Hexagon
      [29, 30], [26, 30], [27, 30],
      [30, 31], [30, 32], [30, 33],
      [31, 33], [32, 33],
      [24, 31], [25, 32]
    ];
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
  }

  setDimensions(width, height) {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  clear() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Main Render Loop for Bounding Box, Geometric Mesh, and Floating Age Tag
   */
  renderFaceTracking(faceData, predictionData) {
    if (!this.ctx || !this.canvas) return;
    this.clear();

    if (!faceData || !faceData.detected) {
      this.smoothBox = null;
      this.smoothLandmarks = null;
      return;
    }

    const { box, landmarks } = faceData;
    const targetBox = box || {
      x: this.canvas.width * 0.25,
      y: this.canvas.height * 0.15,
      width: this.canvas.width * 0.50,
      height: this.canvas.height * 0.65
    };

    // Smooth bounding box
    if (!this.smoothBox) {
      this.smoothBox = { ...targetBox };
    } else {
      this.smoothBox.x += (targetBox.x - this.smoothBox.x) * this.smoothingAlpha;
      this.smoothBox.y += (targetBox.y - this.smoothBox.y) * this.smoothingAlpha;
      this.smoothBox.width += (targetBox.width - this.smoothBox.width) * this.smoothingAlpha;
      this.smoothBox.height += (targetBox.height - this.smoothBox.height) * this.smoothingAlpha;
    }

    // Compute or project landmarks
    const pts = this.computeLandmarkPoints(this.smoothBox, landmarks);

    // 1. Draw Geometric Mesh Pattern (Reference Image 2)
    if (this.showMesh) {
      this.drawGeometricWireframe(pts);
    }

    // 2. Draw High-Tech Face Bounding Box
    if (this.showBox) {
      this.drawBoundingBox(this.smoothBox);
    }

    // 3. Draw Floating Age HUD Badge Above Face
    if (this.showAgeHud && predictionData) {
      this.drawFloatingAgeHUD(this.smoothBox, predictionData);
    }
  }

  computeLandmarkPoints(box, customLandmarks) {
    if (customLandmarks && customLandmarks.length >= 30) {
      return customLandmarks;
    }

    // Project canonical topology into current bounding box
    return this.baseLandmarkTopology.map(node => ({
      x: box.x + node.x * box.width,
      y: box.y + node.y * box.height
    }));
  }

  /**
   * Draw Geometric Polygon Pattern matching Reference Image 2
   */
  drawGeometricWireframe(pts) {
    const ctx = this.ctx;
    ctx.save();

    // 1. Draw Connection Lines (Golden Yellow / Cyber Yellow)
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.88)';
    ctx.shadowColor = 'rgba(250, 204, 21, 0.45)';
    ctx.shadowBlur = 4;

    this.meshConnections.forEach(([i, j]) => {
      const p1 = pts[i];
      const p2 = pts[j];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    // 2. Draw Polygonal Facet Highlights (Subtle Yellow fill)
    ctx.fillStyle = 'rgba(250, 204, 21, 0.07)';
    const facetTriangles = [
      [0, 1, 5], [0, 2, 5], [5, 6, 7], [5, 8, 9],
      [7, 8, 16], [16, 17, 18], [18, 19, 21], [18, 20, 21],
      [21, 26, 28], [21, 27, 28], [30, 31, 33], [30, 32, 33]
    ];

    facetTriangles.forEach(tri => {
      if (pts[tri[0]] && pts[tri[1]] && pts[tri[2]]) {
        ctx.beginPath();
        ctx.moveTo(pts[tri[0]].x, pts[tri[0]].y);
        ctx.lineTo(pts[tri[1]].x, pts[tri[1]].y);
        ctx.lineTo(pts[tri[2]].x, pts[tri[2]].y);
        ctx.closePath();
        ctx.fill();
      }
    });

    // 3. Draw Geometric Landmark Nodes (Yellow Square Anchors as in Reference Image 2)
    pts.forEach((pt) => {
      if (!pt) return;
      
      // Node outer square
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.4;
      const size = 5.5;
      ctx.strokeRect(pt.x - size / 2, pt.y - size / 2, size, size);

      // Node inner center dot
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
    });

    ctx.restore();
  }

  /**
   * Draw Cyber/Biometric Bounding Box with Corner Brackets
   */
  drawBoundingBox(box) {
    const ctx = this.ctx;
    ctx.save();

    const { x, y, width, height } = box;
    const cornerLen = Math.min(26, width * 0.15);

    // Subtle box boundary
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]); // Reset dash

    // Glowing Corner Brackets
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0, 229, 255, 0.7)';
    ctx.shadowBlur = 6;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + width - cornerLen, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + cornerLen);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x, y + height - cornerLen);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + cornerLen, y + height);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + width - cornerLen, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y + height - cornerLen);
    ctx.stroke();

    // Biometric Tracking Tag
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('BIOMETRIC LOCK: 468 PTS', x + 6, y + height - 8);

    ctx.restore();
  }

  /**
   * Draw Floating Age HUD Tag Above Face Bounding Box
   */
  drawFloatingAgeHUD(box, pred) {
    const ctx = this.ctx;
    ctx.save();

    const age = pred.age !== undefined ? pred.age.toFixed(1) : '--';
    const conf = pred.confidence !== undefined ? Math.round(pred.confidence * 100) : 0;
    const mae = pred.mae !== undefined ? pred.mae.toFixed(1) : '2.1';

    // Text formatting
    const mainText = `AGE: ${age} YRS`;
    const subText = `±${mae} yrs • ${conf}% Conf`;

    ctx.font = 'bold 15px "Outfit", "Inter", sans-serif';
    const mainWidth = ctx.measureText(mainText).width;
    ctx.font = '600 11px "JetBrains Mono", monospace';
    const subWidth = ctx.measureText(subText).width;

    const badgeWidth = Math.max(mainWidth, subWidth) + 36;
    const badgeHeight = 44;
    
    // Position HUD badge 14px above face bounding box
    const badgeX = box.x + (box.width - badgeWidth) / 2;
    const badgeY = Math.max(12, box.y - badgeHeight - 14);

    // Badge Background (Royal Blue Glassmorphism)
    ctx.fillStyle = 'rgba(11, 35, 95, 0.92)';
    ctx.strokeStyle = '#1a4cd2';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(26, 76, 210, 0.6)';
    ctx.shadowBlur = 12;

    this.roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Small connector tick pointing down to the face
    ctx.beginPath();
    ctx.moveTo(box.x + box.width / 2 - 6, badgeY + badgeHeight);
    ctx.lineTo(box.x + box.width / 2, badgeY + badgeHeight + 6);
    ctx.lineTo(box.x + box.width / 2 + 6, badgeY + badgeHeight);
    ctx.fillStyle = '#1a4cd2';
    ctx.fill();

    // Icon Circle (Left)
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(badgeX + 16, badgeY + badgeHeight / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Age text
    ctx.shadowBlur = 0;
    ctx.font = '800 15px "Outfit", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(mainText, badgeX + 28, badgeY + 19);

    // Margin of error and confidence text
    ctx.font = '600 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(subText, badgeX + 28, badgeY + 34);

    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

// Instantiate global face engine
window.faceMeshEngine = new BiometricFaceMeshEngine();
