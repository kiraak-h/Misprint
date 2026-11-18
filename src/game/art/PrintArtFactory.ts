import Phaser from 'phaser';

export const PRINT_PALETTE = {
  paperCream: 0xf4efe4,
  paperSheet: 0xfaf7f0,
  paperWarm: 0xebe3d3,
  paperShadow: 0xdfd5c1,
  ghostTint: 0xe6edf5,
  charcoal: 0x1e2024,
  charcoalMuted: 0x555961,
  sepia: 0x7c6f5b,
  cobalt: 0x2f5485,
  vermilion: 0xc93b2b,
  ochre: 0xb8832c,
  sage: 0x3a6b52,
  kraft: 0xd4ad7a,
} as const;

export type DotPose =
  | 'walk0'
  | 'walk1'
  | 'walk2'
  | 'walk3'
  | 'idle0'
  | 'idle1'
  | 'fall'
  | 'land'
  | 'celebrate'
  | 'hazard';

function drawHandDrawnDotFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pose: DotPose,
): void {
  ctx.clearRect(0, 0, w, h);
  const cx = w * 0.5;
  const footY = h - 5;

  let stride = 0;
  let bobY = 0;
  let tilt = 0;
  let armRaise = 0;
  let scarfWave = 0;
  let crouch = 0;
  let eyeBlink = false;
  let eyeWide = false;
  let eyeHappy = false;
  let eyeWince = false;

  switch (pose) {
    case 'walk0':
      stride = -6.5;
      bobY = -1.5;
      tilt = 0.055;
      scarfWave = 2.5;
      break;
    case 'walk1':
      stride = -1;
      bobY = -4;
      tilt = 0.07;
      scarfWave = -1.5;
      break;
    case 'walk2':
      stride = 6.5;
      bobY = -1.5;
      tilt = 0.045;
      scarfWave = -3;
      break;
    case 'walk3':
      stride = 1;
      bobY = 0;
      tilt = 0.02;
      scarfWave = 1.5;
      break;
    case 'idle0':
      bobY = 0;
      scarfWave = 0.5;
      break;
    case 'idle1':
      bobY = 1.2;
      eyeBlink = true;
      scarfWave = 1.2;
      break;
    case 'fall':
      bobY = -4;
      tilt = -0.11;
      armRaise = -6;
      scarfWave = -7;
      eyeWide = true;
      break;
    case 'land':
      bobY = 4;
      crouch = 2.5;
      tilt = 0.06;
      armRaise = 2;
      scarfWave = 3;
      break;
    case 'celebrate':
      bobY = -5;
      armRaise = -11;
      scarfWave = -4;
      eyeHappy = true;
      break;
    case 'hazard':
      bobY = 2;
      tilt = -0.16;
      armRaise = -2;
      scarfWave = -5;
      eyeWince = true;
      break;
  }

  ctx.save();
  ctx.translate(cx, footY);

  // Subtle ink ground contact shadow
  if (pose !== 'fall') {
    const shadowScale = pose === 'celebrate' ? 0.78 : pose === 'land' ? 1.18 : 1;
    ctx.fillStyle = 'rgba(30, 32, 36, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 0.5, 13 * shadowScale, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Legs & cuffed courier boots
  const leftFootX = -5 + stride;
  const rightFootX = 5 - stride;
  const leftLift = pose === 'walk0' ? -3.5 : pose === 'fall' ? -4 : 0;
  const rightLift = pose === 'walk2' ? -3.5 : pose === 'fall' ? -2.5 : 0;

  const drawLegAndBoot = (hipX: number, footX: number, liftY: number, shade: boolean) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e2024';
    ctx.lineWidth = 3.1;
    ctx.beginPath();
    ctx.moveTo(hipX, -12 + bobY + crouch);
    ctx.quadraticCurveTo(
      (hipX + footX) * 0.5,
      -6.5 + bobY + liftY * 0.5,
      footX,
      -2.5 + liftY,
    );
    ctx.stroke();

    // Boot silhouette
    ctx.fillStyle = shade ? '#2d3138' : '#1e2024';
    ctx.beginPath();
    ctx.ellipse(footX + 2, -1.8 + liftY, 4.4, 2.5, -0.05, 0, Math.PI * 2);
    ctx.fill();
    // Sole highlight
    ctx.strokeStyle = '#555961';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(footX - 1.5, -0.6 + liftY);
    ctx.lineTo(footX + 5.2, -0.6 + liftY);
    ctx.stroke();
  };

  drawLegAndBoot(-2.5, leftFootX, leftLift, true);
  drawLegAndBoot(2.5, rightFootX, rightLift, false);

  // Upper body assembly
  ctx.translate(0, bobY + crouch * 0.5);
  ctx.rotate(tilt);

  // Fluttering cobalt courier scarf tail with stitched hem
  ctx.save();
  ctx.fillStyle = '#2f5485';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -25);
  ctx.bezierCurveTo(-15, -26 + scarfWave * 0.5, -21, -21 + scarfWave, -22, -16 + scarfWave);
  ctx.lineTo(-17, -15 + scarfWave);
  ctx.bezierCurveTo(-14, -18 + scarfWave * 0.5, -10, -18, -5, -19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Scarf fringe strokes
  ctx.strokeStyle = '#faf7f0';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-18.5, -17.5 + scarfWave);
  ctx.lineTo(-21, -16.8 + scarfWave);
  ctx.stroke();
  ctx.restore();

  // Vermilion hooded/flared courier coat silhouette (organic hand-inked bell)
  ctx.fillStyle = '#c93b2b';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-10.5, -10.5);
  ctx.bezierCurveTo(-12, -20, -9, -28, 0, -30);
  ctx.bezierCurveTo(9.5, -28, 12, -19, 10.5, -10.5);
  ctx.quadraticCurveTo(0, -7.5, -10.5, -10.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Risograph/woodcut shadow fold on back of coat
  ctx.fillStyle = 'rgba(30, 32, 36, 0.14)';
  ctx.beginPath();
  ctx.moveTo(-9.2, -11.2);
  ctx.quadraticCurveTo(-10, -21, -3, -27);
  ctx.quadraticCurveTo(-5, -19, -3.5, -10.5);
  ctx.closePath();
  ctx.fill();

  // Cream woodcut highlight crease + brass coat buttons
  ctx.strokeStyle = 'rgba(250, 247, 240, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(3.5, -24);
  ctx.quadraticCurveTo(5.2, -18, 4.5, -12);
  ctx.stroke();

  ctx.fillStyle = '#b8832c';
  ctx.beginPath();
  ctx.arc(2.5, -21, 1.3, 0, Math.PI * 2);
  ctx.arc(3.0, -16, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Cobalt neck scarf collar
  ctx.fillStyle = '#2f5485';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-8.5, -29.5, 17, 5, 2.5);
  ctx.fill();
  ctx.stroke();

  // Courier head (warm paper cream with slight cheek tint)
  ctx.fillStyle = '#faf7f0';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0.5, -36, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rosy cheek accent
  ctx.fillStyle = 'rgba(201, 59, 43, 0.22)';
  ctx.beginPath();
  ctx.ellipse(5.5, -33.2, 2.3, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Expressive eyes & brows
  ctx.strokeStyle = '#1e2024';
  ctx.fillStyle = '#1e2024';
  if (eyeBlink) {
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(0.2, -35.8);
    ctx.quadraticCurveTo(2.0, -34.5, 3.8, -35.8);
    ctx.moveTo(5.4, -35.8);
    ctx.quadraticCurveTo(7.1, -34.5, 8.8, -35.8);
    ctx.stroke();
  } else if (eyeHappy) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0.2, -35);
    ctx.quadraticCurveTo(2.0, -37.5, 3.8, -35);
    ctx.moveTo(5.4, -35);
    ctx.quadraticCurveTo(7.1, -37.5, 8.8, -35);
    ctx.stroke();
  } else if (eyeWince) {
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(0.5, -37.5);
    ctx.lineTo(3.8, -35.5);
    ctx.lineTo(0.5, -33.8);
    ctx.moveTo(8.5, -37.5);
    ctx.lineTo(5.2, -35.5);
    ctx.lineTo(8.5, -33.8);
    ctx.stroke();
  } else if (eyeWide) {
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(2.2, -35.8, 2.7, 0, Math.PI * 2);
    ctx.arc(7.1, -35.8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1e2024';
    ctx.beginPath();
    ctx.arc(2.7, -35.8, 1.3, 0, Math.PI * 2);
    ctx.arc(7.5, -35.8, 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(2.1, -35.8, 1.45, 2.0, 0, 0, Math.PI * 2);
    ctx.ellipse(7.0, -35.8, 1.35, 1.9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tiny eye glint
    ctx.fillStyle = '#faf7f0';
    ctx.beginPath();
    ctx.arc(1.7, -36.5, 0.55, 0, Math.PI * 2);
    ctx.arc(6.6, -36.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hand-drawn courier peaked cap with ochre brass emblem
  ctx.fillStyle = '#c93b2b';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(0, -39, 10.3, Math.PI * 1.02, Math.PI * 2.02);
  ctx.lineTo(13.2, -38.5);
  ctx.quadraticCurveTo(4, -37.2, -10.3, -38.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#b8832c';
  ctx.beginPath();
  ctx.arc(4.8, -42.5, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Courier sleeve reaching forward to carry parcel
  const parcelX = 9.5;
  const parcelY = -19 + armRaise;
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, -23);
  ctx.lineTo(parcelX - 3, parcelY + 2);
  ctx.stroke();
  ctx.strokeStyle = '#c93b2b';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(2, -23);
  ctx.lineTo(parcelX - 3, parcelY + 2);
  ctx.stroke();

  // Kraft-paper Parcel with folded flaps, twine bow & wax seal
  ctx.save();
  ctx.translate(parcelX, parcelY);
  ctx.rotate(pose === 'celebrate' ? -0.22 : pose === 'fall' ? -0.14 : 0.08);
  ctx.fillStyle = '#d4ad7a';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-7, -6.5, 14, 11.5, 1.5);
  ctx.fill();
  ctx.stroke();

  // Kraft parcel top shading flap
  ctx.fillStyle = 'rgba(30, 32, 36, 0.1)';
  ctx.fillRect(-6.2, -5.8, 12.4, 3);

  // Cream string twine + bow
  ctx.strokeStyle = '#faf7f0';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, -6.5);
  ctx.lineTo(0, 5);
  ctx.moveTo(-7, -0.8);
  ctx.lineTo(7, -0.8);
  ctx.stroke();

  // Vermilion wax stamp seal
  ctx.fillStyle = '#c93b2b';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, -0.8, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawGoalPostbox(ctx: CanvasRenderingContext2D, w: number, h: number, delivered = false): void {
  ctx.clearRect(0, 0, w, h);
  const cx = w * 0.5 - 2;
  const baseY = h - 5;

  // Celebratory golden aura when delivered
  if (delivered) {
    ctx.fillStyle = 'rgba(184, 131, 44, 0.16)';
    ctx.beginPath();
    ctx.arc(cx, baseY - 44, 34, 0, Math.PI * 2);
    ctx.fill();

    // Delicate starburst rays
    ctx.strokeStyle = 'rgba(184, 131, 44, 0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 22, baseY - 44 + Math.sin(angle) * 22);
      ctx.lineTo(cx + Math.cos(angle) * 32, baseY - 44 + Math.sin(angle) * 32);
      ctx.stroke();
    }
  }

  // Ground contact shadow + cobblestone plinth
  ctx.fillStyle = 'rgba(30, 32, 36, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 1, 20, 4.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ebe3d3';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - 12, baseY - 5, 24, 6, 2);
  ctx.fill();
  ctx.stroke();

  // Cobalt iron timber post with bevel highlight
  ctx.fillStyle = '#2f5485';
  ctx.beginPath();
  ctx.rect(cx - 5, baseY - 34, 10, 30);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(250, 247, 240, 0.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 2.5, baseY - 32);
  ctx.lineTo(cx - 2.5, baseY - 7);
  ctx.stroke();

  // Vermilion letterpress postbox housing
  ctx.fillStyle = '#c93b2b';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(cx - 18, baseY - 62, 36, 31, [14, 14, 3, 3]);
  ctx.fill();
  ctx.stroke();

  // Woodblock shadow crescent on right side of postbox
  ctx.fillStyle = 'rgba(30, 32, 36, 0.14)';
  ctx.beginPath();
  ctx.roundRect(cx + 6, baseY - 59, 10, 26, [0, 12, 2, 0]);
  ctx.fill();

  // Cream brass-rimmed mail slot
  ctx.fillStyle = '#faf7f0';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(cx - 12, baseY - 49, 24, 6.5, 2);
  ctx.fill();
  ctx.stroke();

  // Inner dark mail slot slit
  ctx.fillStyle = '#1e2024';
  ctx.fillRect(cx - 9, baseY - 46.8, 18, 2);

  // If delivered, show delivered envelope tucked in slot
  if (delivered) {
    ctx.fillStyle = '#faf7f0';
    ctx.strokeStyle = '#1e2024';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(cx - 6, baseY - 54, 12, 8, 1);
    ctx.fill();
    ctx.stroke();

    // Tiny vermilion wax stamp
    ctx.fillStyle = '#c93b2b';
    ctx.beginPath();
    ctx.arc(cx, baseY - 50, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Brass courier emblem circle below slot
  ctx.fillStyle = '#b8832c';
  ctx.beginPath();
  ctx.arc(cx, baseY - 37.5, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Golden delivery pennant flag on side (raised when delivered)
  const flagTopY = delivered ? baseY - 74 : baseY - 66;
  const flagBottomY = delivered ? baseY - 64 : baseY - 56;
  const flagMidY = delivered ? baseY - 69 : baseY - 61;

  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx + 18, baseY - 40);
  ctx.lineTo(cx + 18, flagTopY);
  ctx.stroke();

  ctx.fillStyle = '#b8832c';
  ctx.beginPath();
  ctx.moveTo(cx + 18, flagTopY);
  ctx.lineTo(cx + 31, flagMidY);
  ctx.lineTo(cx + 18, flagBottomY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawInkSpill(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  const cx = w * 0.5;
  const cy = h * 0.54;

  // Faint cobalt/sepia dried stain halo around spill
  ctx.fillStyle = 'rgba(47, 84, 133, 0.16)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, w * 0.42, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main glossy black sumi-ink blotch with smooth organic spline lobes
  ctx.fillStyle = '#1e2024';
  ctx.beginPath();
  const points: Array<[number, number]> = [];
  const lobes = 14;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const r = w * 0.35 * (0.82 + 0.2 * Math.sin(i * 2.4 + 0.5));
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.46]);
  }
  const last = points[points.length - 1]!;
  const first = points[0]!;
  ctx.moveTo((last[0] + first[0]) * 0.5, (last[1] + first[1]) * 0.5);
  for (let i = 0; i < points.length; i++) {
    const cur = points[i]!;
    const nxt = points[(i + 1) % points.length]!;
    ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) * 0.5, (cur[1] + nxt[1]) * 0.5);
  }
  ctx.closePath();
  ctx.fill();

  // Cobalt sheen rim inside wet ink
  ctx.strokeStyle = 'rgba(230, 237, 245, 0.38)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(cx - 8, cy - 4, w * 0.16, h * 0.08, -0.18, 0.15, Math.PI * 0.9);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(250, 247, 240, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(cx + 12, cy + 3, w * 0.06, h * 0.03, 0.2, 0, Math.PI);
  ctx.stroke();

  // Satellite splatter droplets
  const drops: Array<[number, number, number]> = [
    [-w * 0.39, 5, 3.6],
    [-w * 0.31, -11, 2.4],
    [w * 0.41, -4, 3.1],
    [w * 0.34, 10, 2.2],
    [4, -h * 0.28, 2.0],
  ];
  ctx.fillStyle = '#1e2024';
  for (const [dx, dy, r] of drops) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPressRoller(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const r = w * 0.38;

  // Inked rubber cylinder body
  ctx.fillStyle = '#1e2024';
  ctx.strokeStyle = '#1e2024';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Cobalt outer steel rim
  ctx.strokeStyle = '#2f5485';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2.2, 0, Math.PI * 2);
  ctx.stroke();

  // Spiral vermilion printmaker ink treads
  ctx.strokeStyle = '#c93b2b';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r * 0.36), cy + Math.sin(a) * (r * 0.36));
    ctx.lineTo(cx + Math.cos(a + 0.42) * (r * 0.86), cy + Math.sin(a + 0.42) * (r * 0.86));
    ctx.stroke();
  }

  // Brass axle flange & rivet bolts
  ctx.fillStyle = '#b8832c';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#faf7f0';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.fillStyle = '#1e2024';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

function drawCottonInkPaperTexture(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  let seed = 4219;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Subtle laid-paper horizontal chain marks
  ctx.strokeStyle = 'rgba(124, 111, 91, 0.032)';
  ctx.lineWidth = 1;
  for (let y = 8; y < h; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Fine cotton paper tooth speckles
  for (let i = 0; i < 950; i++) {
    const x = nextRand() * w;
    const y = nextRand() * h;
    const dark = nextRand() > 0.44;
    ctx.fillStyle = dark ? 'rgba(30, 32, 36, 0.028)' : 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  // Delicate flax fibers
  ctx.strokeStyle = 'rgba(124, 111, 91, 0.05)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 65; i++) {
    const x = nextRand() * w;
    const y = nextRand() * h;
    const len = 5 + nextRand() * 10;
    const angle = nextRand() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
}

function drawVellumOverlayTexture(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  let seed = 8837;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Fine cobalt-tinted tracing vellum tooth
  for (let i = 0; i < 550; i++) {
    const x = nextRand() * w;
    const y = nextRand() * h;
    ctx.fillStyle = nextRand() > 0.5 ? 'rgba(47, 84, 133, 0.03)' : 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Faint diagonal drafting micro-hatch
  ctx.strokeStyle = 'rgba(47, 84, 133, 0.04)';
  ctx.lineWidth = 0.8;
  for (let x = -h; x < w + h; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h, h);
    ctx.stroke();
  }
}

export function ensurePrintTextures(scene: Phaser.Scene): void {
  const registerCanvas = (
    key: string,
    w: number,
    h: number,
    painter: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  ) => {
    if (scene.textures.exists(key)) return;
    const canvasTex = scene.textures.createCanvas(key, w, h);
    if (!canvasTex) return;
    const ctx = canvasTex.getContext();
    painter(ctx, w, h);
    canvasTex.refresh();
  };

  registerCanvas('paper-grain', 256, 256, drawCottonInkPaperTexture);
  registerCanvas('paper-vellum', 256, 256, drawVellumOverlayTexture);
  registerCanvas('goal-postbox', 76, 80, (ctx, w, h) => drawGoalPostbox(ctx, w, h, false));
  registerCanvas('goal-postbox-delivered', 76, 80, (ctx, w, h) => drawGoalPostbox(ctx, w, h, true));
  registerCanvas('ink-spill', 128, 84, drawInkSpill);
  registerCanvas('press-roller', 64, 64, drawPressRoller);

  const poses: DotPose[] = [
    'walk0',
    'walk1',
    'walk2',
    'walk3',
    'idle0',
    'idle1',
    'fall',
    'land',
    'celebrate',
    'hazard',
  ];

  for (const pose of poses) {
    registerCanvas(`dot-${pose}`, 64, 68, (ctx, w, h) => drawHandDrawnDotFrame(ctx, w, h, pose));
  }
}
