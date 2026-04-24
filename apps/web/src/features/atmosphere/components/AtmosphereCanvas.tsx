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

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centered = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  vec2 parallax = (u_mouse - 0.5) * 0.035;

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
}: Readonly<{
  className?: string;
  isPlaying?: boolean;
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
  }, [isPlaying]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
