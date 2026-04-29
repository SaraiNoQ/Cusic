'use client';

import { useEffect, useRef } from 'react';

const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_energy;
uniform float u_theme;

varying vec2 v_uv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;

  for (int i = 0; i < 5; i++) {
    value += noise(p) * amp;
    p *= 2.08;
    amp *= 0.52;
  }

  return value;
}

float stars(vec2 uv, float scale, float threshold, float speed) {
  vec2 grid = uv * scale;
  vec2 id = floor(grid);
  vec2 starPos = vec2(hash(id + vec2(17.0, 3.0)), hash(id + vec2(5.0, 91.0))) * 0.86 + 0.07;
  vec2 local = fract(grid) - starPos;
  float rnd = hash(id);
  float size = mix(0.012, 0.058, hash(id + vec2(31.0, 7.0)));
  float twinkle = 0.62 + 0.38 * sin(u_time * speed + rnd * 24.0);
  float pulse = 0.58 + 0.42 * sin(u_time * speed * 2.3 + rnd * 41.0);
  float core = smoothstep(size, 0.0, length(local));
  float halo = smoothstep(size * 8.5, 0.0, length(local));
  float rayX = smoothstep(size * 8.5, 0.0, abs(local.x)) * smoothstep(size * 0.34, 0.0, abs(local.y));
  float rayY = smoothstep(size * 8.5, 0.0, abs(local.y)) * smoothstep(size * 0.34, 0.0, abs(local.x));
  float brightness = mix(0.36, 1.85, hash(id + vec2(71.0, 19.0)));
  float starShape = max(core, (rayX + rayY) * 0.46) + halo * pulse * 0.2;

  return starShape * step(threshold, rnd) * twinkle * brightness;
}

/* ── Light theme: constellation lines between nearby stars ── */
float constellationLine(vec2 a, vec2 b, vec2 uv, float thickness) {
  vec2 pa = uv - a;
  vec2 ba = b - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * t);
  return smoothstep(thickness, thickness * 0.3, d);
}

/* ── Light theme: orbital arc ── */
float orbitalArc(vec2 uv, vec2 center, float radius, float thickness, float startAngle, float sweep) {
  vec2 d = uv - center;
  float angle = atan(d.y, d.x);
  float r = length(d);
  float arc = smoothstep(thickness, thickness * 0.2, abs(r - radius));
  float mask = smoothstep(startAngle - 0.02, startAngle, angle) * smoothstep(startAngle + sweep + 0.02, startAngle + sweep, angle);
  return arc * mask;
}

/* ── Dark theme (original) ── */
vec3 darkTheme(vec2 uv, vec2 centered, vec2 parallax, float aspect) {
  vec3 color = mix(vec3(0.006, 0.014, 0.024), vec3(0.018, 0.038, 0.062), uv.y);
  color += vec3(0.015, 0.034, 0.058) * fbm(centered * 2.4 + parallax + vec2(0.0, u_time * 0.015));

  float starA = stars(uv + parallax * 0.8 + vec2(u_time * 0.003, 0.0), 120.0, 0.968, 2.0);
  float starB = stars(uv + parallax * 1.5 + vec2(-u_time * 0.002, u_time * 0.001), 210.0, 0.982, 3.8);
  float amberStars = stars(uv + parallax, 95.0, 0.986, 1.4);
  color += vec3(0.78, 0.88, 1.0) * starA * (0.42 + u_energy * 0.18);
  color += vec3(1.0, 0.75, 0.47) * amberStars * 0.58;
  color += vec3(0.82, 0.9, 1.0) * starB * 0.34;

  vec2 sunUv = vec2((uv.x - 0.16) * aspect, uv.y - 0.62);
  float sun = 1.0 / (1.0 + dot(sunUv, sunUv) * 430.0);
  float ray = smoothstep(0.012, 0.0, abs(uv.y - 0.62)) * smoothstep(0.36, 0.02, abs(uv.x - 0.16));
  color += vec3(1.0, 0.62, 0.28) * (sun * 0.82 + ray * 0.18);

  vec2 planetUv = vec2((uv.x - 0.72) * aspect, uv.y - 1.03);
  float planetDistance = length(planetUv);
  float planet = 1.0 - smoothstep(0.74, 0.84, planetDistance);
  float rim = smoothstep(0.68, 0.83, planetDistance) * (1.0 - smoothstep(0.82, 0.89, planetDistance));
  float atmosphere = smoothstep(0.72, 0.86, planetDistance) * (1.0 - smoothstep(0.84, 0.94, planetDistance));
  float landMass = fbm(planetUv * 4.8 + vec2(1.4, -0.35));
  float coastNoise = fbm(planetUv * 14.0 + vec2(-0.4, 1.8));
  float landMask = smoothstep(0.52, 0.66, landMass + (coastNoise - 0.5) * 0.24) * planet;
  float clouds = smoothstep(0.56, 0.78, fbm(planetUv * 9.0 + vec2(u_time * 0.006, 0.3))) * planet * 0.34;
  float night = smoothstep(0.34, -0.3, planetUv.x * 0.78 + planetUv.y * 0.16);
  float lights = step(0.78, fbm(planetUv * 78.0)) * landMask * night;
  vec3 ocean = vec3(0.012, 0.082, 0.15) + vec3(0.015, 0.1, 0.16) * smoothstep(0.84, 0.18, planetDistance);
  vec3 landColor = vec3(0.075, 0.118, 0.072) + vec3(0.055, 0.052, 0.026) * coastNoise;
  vec3 earth = mix(ocean, landColor, landMask * 0.9);
  earth += vec3(0.38, 0.56, 0.64) * clouds;
  color = mix(color, earth, planet * 0.94);
  color += vec3(1.0, 0.74, 0.42) * lights * 0.16;
  color += vec3(0.42, 0.78, 1.0) * rim * (0.78 + u_energy * 0.18);
  color += vec3(0.2, 0.58, 0.9) * atmosphere * 0.18;

  float vignette = smoothstep(0.88, 0.24, length(centered));
  color *= 0.68 + vignette * 0.42;

  return color;
}

/* ── Light theme: NASA-punk cosmic editorial ── */
vec3 lightTheme(vec2 uv, vec2 centered, vec2 parallax, float aspect) {
  /* ── palette ── */
  vec3 paper    = vec3(0.961, 0.941, 0.906);
  vec3 ink      = vec3(0.18, 0.16, 0.13);
  vec3 amber    = vec3(0.82, 0.56, 0.22);
  vec3 amberDim = vec3(0.62, 0.38, 0.14);
  vec3 teal     = vec3(0.34, 0.62, 0.68);
  vec3 rose     = vec3(0.72, 0.34, 0.28);
  vec3 gold     = vec3(0.88, 0.68, 0.28);

  /* ── paper grain ── */
  float grain  = fbm(uv * 340.0 + parallax * 14.0) * 0.022;
  float grain2 = fbm(uv * 190.0 - parallax * 9.0 + u_time * 0.002) * 0.012;
  vec3 color   = paper - grain - grain2;

  /* ── animated nebula ribbons ── */
  float nebA = fbm(uv * 1.6 + parallax * 1.4 + vec2(u_time * 0.014, 0.0));
  float nebB = fbm(uv * 2.2 - parallax * 0.7 + vec2(0.0, u_time * 0.011));
  float nebC = fbm(uv * 3.0 + parallax * 0.5 + vec2(u_time * 0.009, -u_time * 0.006));
  color += amber * nebA * 0.06;
  color += teal  * nebB * 0.044;
  color += rose  * nebC * 0.028;

  /* ── grand sun with solar corona ── */
  vec2 sunCenter = vec2(0.5, -0.28);
  float sunDist  = length(uv - sunCenter);
  float sunBody  = 1.0 - smoothstep(0.18, 0.42, sunDist);
  color += gold  * sunBody * 0.18;
  color += amber * sunBody * 0.12;

  /* solar corona wisps */
  for (int i = 0; i < 5; i++) {
    float a = float(i) * 1.256 + u_time * 0.04;
    float coronaArm = sunBody * smoothstep(0.44, 0.18, sunDist) *
      (0.28 + 0.72 * (sin(atan(uv.y - sunCenter.y, uv.x - sunCenter.x) * 3.0 + a) * 0.5 + 0.5));
    color += gold * coronaArm * 0.07;
  }

  /* solar halo rings */
  float halo1 = smoothstep(0.006, 0.001, abs(sunDist - 0.26));
  float halo2 = smoothstep(0.008, 0.002, abs(sunDist - 0.34));
  float halo3 = smoothstep(0.01, 0.003, abs(sunDist - 0.44));
  color = mix(color, gold * 1.2,  halo1 * 0.16);
  color = mix(color, amber * 0.8, halo2 * 0.11);
  color = mix(color, amber * 0.4, halo3 * 0.06);

  /* ── star field — two layers ── */
  float starsA = stars(uv + parallax * 0.5 + vec2(u_time * 0.004, 0.0), 130.0, 0.968, 2.4);
  float starsB = stars(uv + parallax * 0.8 + vec2(-u_time * 0.003, u_time * 0.002), 200.0, 0.978, 3.6);
  color = mix(color, ink, starsA * 0.48);
  color = mix(color, amberDim, starsB * 0.3);
  color += gold * starsA * 0.04;

  /* ── constellation network ── */
  vec2 c[10];
  c[0] = vec2(0.08, 0.25) + parallax * 0.2;   c[1] = vec2(0.18, 0.14) + parallax * 0.2;
  c[2] = vec2(0.14, 0.36) + parallax * 0.2;   c[3] = vec2(0.26, 0.22) + parallax * 0.2;
  c[4] = vec2(0.34, 0.42) + parallax * 0.2;   c[5] = vec2(0.68, 0.58) + parallax * 0.4;
  c[6] = vec2(0.82, 0.48) + parallax * 0.4;   c[7] = vec2(0.76, 0.38) + parallax * 0.4;
  c[8] = vec2(0.86, 0.64) + parallax * 0.4;   c[9] = vec2(0.74, 0.74) + parallax * 0.4;

  float lines = 0.0;
  lines += constellationLine(c[0], c[1], uv, 0.0006);
  lines += constellationLine(c[1], c[3], uv, 0.0006);
  lines += constellationLine(c[0], c[2], uv, 0.0006);
  lines += constellationLine(c[2], c[3], uv, 0.0006);
  lines += constellationLine(c[3], c[4], uv, 0.0006);
  lines += constellationLine(c[5], c[6], uv, 0.0005);
  lines += constellationLine(c[6], c[7], uv, 0.0005);
  lines += constellationLine(c[5], c[8], uv, 0.0005);
  lines += constellationLine(c[8], c[9], uv, 0.0005);
  lines += constellationLine(c[7], c[9], uv, 0.0005);
  color = mix(color, ink * 0.55, lines * 0.22);

  /* constellation vertices with glow */
  for (int ii = 0; ii < 10; ii++) {
    float d = length(uv - c[ii]);
    float dot = smoothstep(0.005, 0.0008, d);
    float glow = smoothstep(0.045, 0.0, d);
    color = mix(color, ink, dot * 0.65);
    color += gold * glow * 0.07;
  }

  /* ── orbital mechanics — animated ── */
  vec2 orbCenter = vec2(0.5, 0.55);
  float orbAngle  = u_time * 0.06;    /* slow rotation */
  float orbAngle2 = u_time * 0.093;

  float orb1 = orbitalArc(uv, orbCenter, 0.28, 0.001, orbAngle, 2.5);
  float orb2 = orbitalArc(uv, orbCenter, 0.38, 0.0008, orbAngle2 + 1.4, 2.0);
  float orb3 = orbitalArc(uv, orbCenter, 0.48, 0.001, orbAngle - 0.7, 3.0);
  float orb4 = orbitalArc(uv, orbCenter, 0.22, 0.0006, orbAngle2 + 2.8, 1.5);

  color = mix(color, teal * 0.7,  orb1 * 0.14);
  color = mix(color, amber * 0.65, orb2 * 0.12);
  color = mix(color, ink * 0.5,   orb3 * 0.09);
  color = mix(color, gold * 0.5,  orb4 * 0.1);

  /* ── planet transit silhouette ── */
  vec2 planetCenter = vec2(0.3 + u_time * 0.015, 0.68);
  float planetDist = length(uv - planetCenter);
  float planetBody = 1.0 - smoothstep(0.08, 0.12, planetDist);
  color = mix(color, ink * 0.5, planetBody * 0.3);

  /* planetary ring */
  float ringDist = abs(length(uv - planetCenter) - 0.13);
  float ringMask = smoothstep(0.006, 0.001, ringDist);
  /* tilt the ring */
  float ringTilt = smoothstep(0.0, 0.04, abs((uv.y - planetCenter.y) * 0.7 - (uv.x - planetCenter.x) * 0.3));
  color = mix(color, gold * 0.7, ringMask * ringTilt * 0.25);

  /* subtle planet detail — bands */
  float band = planetBody * smoothstep(0.0, 0.04, abs(uv.y - planetCenter.y) - 0.03);
  color = mix(color, ink * 0.3, band * 0.4);

  /* ── cross-hairs — mission control ── */
  float cx = smoothstep(0.0006, 0.0001, abs(uv.y - 0.44)) * smoothstep(0.16, 0.0, abs(uv.x - 0.5));
  float cy = smoothstep(0.0006, 0.0001, abs(uv.x - 0.5)) * smoothstep(0.16, 0.0, abs(uv.y - 0.44));
  float cross = cx + cy;

  /* concentric pairs */
  float ch2 = smoothstep(0.0006, 0.0001, abs(uv.y - 0.56)) * smoothstep(0.16, 0.0, abs(uv.x - 0.5))
             + smoothstep(0.0006, 0.0001, abs(uv.x - 0.5)) * smoothstep(0.16, 0.0, abs(uv.y - 0.56));
  color = mix(color, ink * 0.35, cross * 0.07);
  color = mix(color, ink * 0.2, ch2 * 0.04);

  /* ── radiation rings pulsing from solar center ── */
  float radPulse = sin(u_time * 0.8) * 0.5 + 0.5;
  float dashMod = sin(atan(uv.y - sunCenter.y, uv.x - sunCenter.x) * 36.0 + u_time * 1.2) * 0.5 + 0.5;
  float radR1 = smoothstep(0.012, 0.002, abs(sunDist - 0.52)) * (0.4 + 0.6 * radPulse);
  float radR2 = smoothstep(0.014, 0.003, abs(sunDist - 0.62)) * (0.3 + 0.7 * dashMod);
  color = mix(color, amber * 0.45, radR1 * dashMod * 0.08);
  color = mix(color, gold * 0.35,  radR2 * 0.06);

  /* ── comets ── */
  float comet1 = 0.0;
  {
    vec2 head = vec2(0.72 + u_time * 0.022, 0.78 + sin(2.9 + u_time * 0.03) * 0.12);
    float dist = length(uv - head);
    float t = dot(uv - head, vec2(-0.82, -0.34)) / max(length(uv - head), 0.001);
    float tail = smoothstep(0.002, 0.0, dist) * smoothstep(0.28, 0.0, t) * smoothstep(-0.0, 0.02, t);
    float headMask = smoothstep(0.006, 0.001, dist);
    comet1 = headMask + tail * 0.3;
  }

  float comet2 = 0.0;
  {
    vec2 h2 = vec2(0.18 - u_time * 0.017, 0.32 + cos(4.2 + u_time * 0.025) * 0.09);
    float d2 = length(uv - h2);
    float t2 = dot(uv - h2, vec2(0.78, 0.42)) / max(length(uv - h2), 0.001);
    float tail2 = smoothstep(0.0015, 0.0, d2) * smoothstep(0.22, 0.0, t2) * smoothstep(-0.0, 0.02, t2);
    float head2 = smoothstep(0.005, 0.0008, d2);
    comet2 = head2 + tail2 * 0.25;
  }

  color = mix(color, gold * 0.9,  comet1 * 0.4);
  color = mix(color, amber * 0.7, comet2 * 0.32);

  /* ── subtle isometric grid — NASA-punk blueprint feel ── */
  float gridX = abs(fract(uv.x * 24.0 + uv.y * 12.0) - 0.5) * 2.0;
  float gridY = abs(fract(uv.y * 24.0 + uv.x * 12.0) - 0.5) * 2.0;
  float grid = smoothstep(0.92, 0.98, gridX) * smoothstep(0.92, 0.98, gridY);
  color = mix(color, ink * 0.18, grid * 0.03);

  /* ── energy-reactive pulse ── */
  float pulse = sin(u_time * 2.4) * 0.5 + 0.5;
  color += gold * u_energy * pulse * 0.018;
  color += amber * u_energy * (1.0 - pulse) * 0.01;

  /* ── vignette — vintage photograph edge ── */
  float vignette = smoothstep(0.96, 0.3, length(centered));
  color = mix(color * 0.9, color, vignette);

  return color;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centered = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  vec2 parallax = (u_mouse - 0.5) * 0.035;

  vec3 color = mix(darkTheme(uv, centered, parallax, aspect),
                   lightTheme(uv, centered, parallax, aspect),
                   u_theme);

  gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource,
  );

  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export function AtmosphereCanvas({
  className,
  isPlaying = false,
  theme = 'dark',
}: Readonly<{
  className?: string;
  isPlaying?: boolean;
  theme?: 'dark' | 'light';
}>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
    });

    if (!gl) {
      return;
    }

    const program = createProgram(gl);
    if (!program) {
      return;
    }

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const mouseLocation = gl.getUniformLocation(program, 'u_mouse');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const energyLocation = gl.getUniformLocation(program, 'u_energy');
    const themeLocation = gl.getUniformLocation(program, 'u_theme');
    const positionBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    let animationFrame = 0;
    let mouseX = 0.5;
    let mouseY = 0.42;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(window.innerWidth * ratio));
      const height = Math.max(1, Math.floor(window.innerHeight * ratio));

      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      gl.viewport(0, 0, width, height);
    };

    const onPointerMove = (event: MouseEvent) => {
      mouseX = event.clientX / window.innerWidth;
      mouseY = 1 - event.clientY / window.innerHeight;
    };

    const draw = (time: number) => {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      if (resolutionLocation) {
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      }
      if (mouseLocation) {
        gl.uniform2f(mouseLocation, mouseX, mouseY);
      }
      if (timeLocation) {
        gl.uniform1f(timeLocation, time * 0.001);
      }
      if (energyLocation) {
        gl.uniform1f(energyLocation, isPlaying ? 1 : 0);
      }
      if (themeLocation) {
        gl.uniform1f(themeLocation, theme === 'light' ? 1.0 : 0.0);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onPointerMove);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onPointerMove);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
    };
  }, [isPlaying, theme]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
