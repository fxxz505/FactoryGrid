import type { CargoRenderPoint } from './canvasRenderer'

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in float a_size;
in vec3 a_color;
in float a_sides;
in float a_kind;
uniform vec2 u_resolution;
out vec3 v_color;
flat out float v_sides;
flat out float v_kind;
void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
  v_sides = a_sides;
  v_kind = a_kind;
}`

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec3 v_color;
flat in float v_sides;
flat in float v_kind;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float radius = length(p);
  if (v_kind > 0.5 && v_kind < 1.5) {
    if (radius > 0.92 || p.x > 0.0) discard;
  } else if (v_kind > 1.5 && v_kind < 2.5) {
    if (abs(p.y) > 0.9 || p.x < -0.9 || p.x > 0.0) discard;
  } else if (v_sides < 2.5) {
    if (radius > 0.92) discard;
  } else {
    float angle = atan(p.y, p.x) + 1.5707963;
    float sector = 6.2831853 / v_sides;
    float edge = cos(sector * 0.5) / cos(mod(angle + sector * 0.5, sector) - sector * 0.5);
    if (radius > edge * 0.9) discard;
  }
  outColor = vec4(v_color, 1.0);
}`

export class WebglCargoRenderer {
  private gl?: WebGL2RenderingContext
  private program?: WebGLProgram
  private buffer?: WebGLBuffer

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true }) ?? undefined
    if (!gl) return
    const program = createProgram(gl)
    if (!program) return
    this.gl = gl
    this.program = program
    this.buffer = gl.createBuffer() ?? undefined
  }

  get available(): boolean {
    return Boolean(this.gl && this.program && this.buffer)
  }

  render(points: CargoRenderPoint[]): void {
    const gl = this.gl
    const program = this.program
    const buffer = this.buffer
    if (!gl || !program || !buffer) return
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
    const width = Math.round(this.canvas.clientWidth * ratio)
    const height = Math.round(this.canvas.clientHeight * ratio)
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    gl.viewport(0, 0, width, height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (!points.length) return
    const data = new Float32Array(points.length * 8)
    points.forEach((point, index) => {
      const color = parseColor(point.color)
      data.set([
        point.x * ratio, point.y * ratio, point.radius * 2 * ratio,
        color[0], color[1], color[2], point.sides, point.kind
      ], index * 8)
    })
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    const stride = 8 * 4
    bindAttribute(gl, program, 'a_position', 2, stride, 0)
    bindAttribute(gl, program, 'a_size', 1, stride, 2 * 4)
    bindAttribute(gl, program, 'a_color', 3, stride, 3 * 4)
    bindAttribute(gl, program, 'a_sides', 1, stride, 6 * 4)
    bindAttribute(gl, program, 'a_kind', 1, stride, 7 * 4)
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height)
    gl.drawArrays(gl.POINTS, 0, points.length)
  }

  clear(): void {
    const gl = this.gl
    if (!gl) return
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram | undefined {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vertex || !fragment) return undefined
  const program = gl.createProgram()
  if (!program) return undefined
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : undefined
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | undefined {
  const shader = gl.createShader(type)
  if (!shader) return undefined
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : undefined
}

function bindAttribute(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, size: number, stride: number, offset: number): void {
  const location = gl.getAttribLocation(program, name)
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset)
}

function parseColor(color: string): [number, number, number] {
  const value = color.startsWith('#') ? color.slice(1) : '647278'
  const normalized = value.length === 3 ? value.split('').map((part) => part + part).join('') : value
  return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255) as [number, number, number]
}
