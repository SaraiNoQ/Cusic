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

/* ── Light theme: NASA-punk editorial space ── */
vec3 lightTheme(vec2 uv, vec2 centered, vec2 parallax, float aspect) {
  vec2 p = centered * 1.8;

  /* warm parchment base */
  vec3 paper = vec3(0.961, 0.941, 0.906);
  vec3 ink = vec3(0.18, 0.16, 0.13);
  vec3 amber = vec3(0.82, 0.56, 0.22);
  vec3 teal = vec3(0.34, 0.62, 0.68);

  /* subtle noise texture — like aged paper grain */
  float grain = fbm(uv * 280.0 + parallax * 20.0) * 0.03;
  vec3 color = paper - grain;

  /* warm nebula wash — very subtle */
  float nebulaA = fbm(uv * 1.8 + parallax + vec2(u_time * 0.008, 0.0));
  float nebulaB = fbm(uv * 2.4 - parallax * 0.6 + vec2(0.0, u_time * 0.005));
  color += amber * nebulaA * 0.045;
  color += teal * nebulaB * 0.03;

  /* constellation star dots — tiny dark ink points */
  float dotA = stars(uv + parallax * 0.3, 60.0, 0.975, 0.8);
  float dotB = stars(uv + parallax * 0.6 + vec2(u_time * 0.001, 0.0), 100.0, 0.985, 1.2);
  color = mix(color, ink, dotA * 0.55);
  color = mix(color, amber * 0.6, dotB * 0.35);

  /* constellation lines — connect nearby bright stars */
  vec2 s1 = vec2(0.15, 0.32) + parallax * 0.3;
  vec2 s2 = vec2(0.28, 0.22) + parallax * 0.3;
  vec2 s3 = vec2(0.38, 0.38) + parallax * 0.3;
  vec2 s4 = vec2(0.22, 0.48) + parallax * 0.3;
  vec2 s5 = vec2(0.72, 0.65) + parallax * 0.5;
  vec2 s6 = vec2(0.82, 0.55) + parallax * 0.5;
  vec2 s7 = vec2(0.78, 0.72) + parallax * 0.5;

  float line = 0.0;
  line += constellationLine(s1, s2, uv, 0.0008);
  line += constellationLine(s2, s3, uv, 0.0008);
  line += constellationLine(s2, s4, uv, 0.0008);
  line += constellationLine(s5, s6, uv, 0.0006);
  line += constellationLine(s6, s7, uv, 0.0006);
  line += constellationLine(s5, s7, uv, 0.0006);
  color = mix(color, ink * 0.5, line * 0.18);

  /* star dots at constellation vertices */
  vec2 verts[7];
  verts[0] = s1; verts[1] = s2; verts[2] = s3; verts[3] = s4;
  verts[4] = s5; verts[5] = s6; verts[6] = s7;
  for (int i = 0; i < 7; i++) {
    float d = length(uv - verts[i]);
    float dot = smoothstep(0.006, 0.001, d);
    float glow = smoothstep(0.04, 0.0, d);
    color = mix(color, ink, dot * 0.7);
    color += amber * glow * 0.06;
  }

  /* orbital arcs — NASA-punk geometric overlay */
  float arc1 = orbitalArc(uv, vec2(0.5, 0.5), 0.38, 0.0012, 0.8, 2.2);
  float arc2 = orbitalArc(uv, vec2(0.5, 0.5), 0.52, 0.0008, -0.4, 1.6);
  float arc3 = orbitalArc(uv, vec2(0.3, 0.3), 0.22, 0.001, 1.2, 1.8);
  color = mix(color, teal * 0.7, arc1 * 0.12);
  color = mix(color, amber * 0.7, arc2 * 0.1);
  color = mix(color, ink * 0.6, arc3 * 0.08);

  /* subtle cross-hairs at center — mission control aesthetic */
  float crossH = smoothstep(0.0008, 0.0002, abs(uv.y - 0.5)) * smoothstep(0.18, 0.0, abs(uv.x - 0.5));
  float crossV = smoothstep(0.0008, 0.0002, abs(uv.x - 0.5)) * smoothstep(0.18, 0.0, abs(uv.y - 0.5));
  color = mix(color, ink * 0.4, (crossH + crossV) * 0.06);

  /* faint ring — planetary orbit */
  float ring = smoothstep(0.003, 0.0005, abs(length(uv - vec2(0.5, 0.5)) - 0.31));
  color = mix(color, amber * 0.5, ring * 0.06);

  /* warm corner glow — like sunlight on parchment */
  float cornerGlow = 1.0 / (1.0 + dot(uv - vec2(0.12, 0.85), uv - vec2(0.12, 0.85)) * 18.0);
  color += amber * cornerGlow * 0.08;

  /* energy-reactive subtle pulse */
  float pulse = sin(u_time * 1.8) * 0.5 + 0.5;
  color += amber * u_energy * pulse * 0.015;

  /* vignette — like an old photograph */
  float vignette = smoothstep(0.95, 0.35, length(centered));
  color = mix(color * 0.88, color, vignette);

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
