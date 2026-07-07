import type { ShapeDefinition } from '../models/factory'

export const shapes: ShapeDefinition[] = [
  { id: 'circle', name: '\u5706\u5f62', code: '\u5706', color: '#65c7f7', description: '\u6765\u81ea\u5706\u5f62\u77ff\u8109\u7684\u57fa\u7840\u56fe\u5f62\u3002' },
  { id: 'square', name: '\u65b9\u5f62', code: '\u65b9', color: '#f5c64f', description: '\u7528\u4e8e\u5207\u5272\u3001\u67d3\u8272\u4e0e\u5806\u53e0\u7684\u57fa\u7840\u56fe\u5f62\u3002' },
  { id: 'star', name: '\u661f\u5f62', code: '\u661f', color: '#8ee86a', description: '\u9ad8\u7ea7\u76ee\u6807\u5e38\u7528\u56fe\u5f62\u3002' },
  { id: 'diamond', name: '\u83f1\u5f62', code: '\u83f1', color: '#c690ff', description: '\u9ad8\u7ea7\u751f\u4ea7\u7ebf\u4e2d\u7684\u88c5\u9970\u56fe\u5f62\u3002' },
  { id: 'half-circle', name: '\u534a\u5706', code: '\u534a\u5706', color: '#65c7f7', accent: '#dff6ff', description: '\u5706\u5f62\u7ecf\u8fc7\u5207\u5272\u540e\u7684\u4ea7\u7269\u3002' },
  { id: 'half-square', name: '\u534a\u65b9', code: '\u534a\u65b9', color: '#f5c64f', accent: '#fff3bf', description: '\u65b9\u5f62\u7ecf\u8fc7\u5207\u5272\u540e\u7684\u4ea7\u7269\u3002' },
  { id: 'circle-red', name: '\u7ea2\u5706', code: '\u7ea2\u5706', color: '#ee5d59', description: '\u5706\u5f62\u7ecf\u8fc7\u7ea2\u8272\u67d3\u8272\u5668\u540e\u7684\u4ea7\u7269\u3002' },
  { id: 'square-blue', name: '\u84dd\u65b9', code: '\u84dd\u65b9', color: '#568cff', description: '\u65b9\u5f62\u7ecf\u8fc7\u84dd\u8272\u67d3\u8272\u5668\u540e\u7684\u4ea7\u7269\u3002' },
  { id: 'star-green', name: '\u7eff\u661f', code: '\u7eff\u661f', color: '#60d971', description: '\u661f\u5f62\u7ecf\u8fc7\u7eff\u8272\u67d3\u8272\u5668\u540e\u7684\u4ea7\u7269\u3002' },
  { id: 'rotated-star', name: '\u65cb\u8f6c\u661f', code: '\u65cb\u661f', color: '#b2f27d', description: '\u661f\u5f62\u7ecf\u8fc7\u65cb\u8f6c\u5668\u540e\u7684\u4ea7\u7269\u3002' },
  { id: 'circle-red+square', name: '\u7ea2\u5706\u53e0\u65b9', code: '\u7ea2\u5706+\u65b9', color: '#ee5d59', accent: '#f5c64f', description: '\u5806\u53e0\u5668\u7ec4\u5408\u51fa\u7684\u590d\u5408\u56fe\u5f62\u3002' },
  { id: 'diamond-blue+star', name: '\u84dd\u83f1\u53e0\u661f', code: '\u84dd\u83f1+\u661f', color: '#568cff', accent: '#8ee86a', description: '\u9ad8\u7ea7\u5806\u53e0\u76ee\u6807\u3002' },
  { id: 'trash', name: '\u5e9f\u6599', code: '\u5e9f', color: '#98a2b3', description: '\u88ab\u56de\u6536\u5668\u6e05\u7406\u7684\u6ea2\u51fa\u56fe\u5f62\u3002' }
]

export const shapeById = Object.fromEntries(shapes.map((shape) => [shape.id, shape])) as Record<string, ShapeDefinition>
