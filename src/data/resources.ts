import type { ShapeDefinition } from '../models/factory'

export const shapes: ShapeDefinition[] = [
  { id: 'circle', name: '圆形', code: '圆', color: '#65c7f7', description: '来自圆形矿脉的基础图形。' },
  { id: 'square', name: '方形', code: '方', color: '#f5c64f', description: '用于切割、染色与堆叠的基础图形。' },
  { id: 'star', name: '星形', code: '星', color: '#8ee86a', description: '高级目标常用图形。' },
  { id: 'diamond', name: '菱形', code: '菱', color: '#c690ff', description: '高级生产线中的装饰图形。' },
  { id: 'iron-ore', name: '铁矿', code: '铁矿', color: '#d7ddd9', accent: '#9ca7a3', description: '灰白色圆形矿物，可与煤矿在熔炉中烧制。' },
  { id: 'coal-ore', name: '煤矿', code: '煤', color: '#242424', accent: '#5c5c58', description: '黑色圆形燃料，供熔炉烧制使用。' },
  { id: 'copper-ore', name: '铜矿', code: '铜矿', color: '#a66a3f', accent: '#d49760', description: '棕色圆形矿物，可与煤矿在熔炉中烧制。' },
  { id: 'iron-ingot', name: '铁锭', code: '铁锭', color: '#cfd6d3', accent: '#f2f5f0', description: '铁矿烧制后的银色三角形产物。' },
  { id: 'copper-ingot', name: '铜锭', code: '铜锭', color: '#b87445', accent: '#e0a36d', description: '铜矿烧制后的棕色三角形产物。' },
  { id: 'iron-gear', name: '齿轮', code: '齿', color: '#b7c0bc', accent: '#eef2ec', description: '合成器使用铁锭制作的齿轮。' },
  { id: 'copper-wire', name: '铜线', code: '铜线', color: '#d0894d', accent: '#f1c38d', description: '合成器将铜锭拉制成的铜线。' },
  { id: 'circuit', name: '简易电路', code: '电路', color: '#4fa186', accent: '#d6e86a', description: '由铁锭与铜线合成的基础电路。' },
  { id: 'half-circle', name: '半圆', code: '半圆', color: '#65c7f7', accent: '#dff6ff', description: '圆形经过切割后的产物。' },
  { id: 'half-square', name: '半方', code: '半方', color: '#f5c64f', accent: '#fff3bf', description: '方形经过切割后的产物。' },
  { id: 'circle-red', name: '红圆', code: '红圆', color: '#ee5d59', description: '圆形经过红色染色器后的产物。' },
  { id: 'square-blue', name: '蓝方', code: '蓝方', color: '#568cff', description: '方形经过蓝色染色器后的产物。' },
  { id: 'star-green', name: '绿星', code: '绿星', color: '#60d971', description: '星形经过绿色染色器后的产物。' },
  { id: 'rotated-star', name: '旋转星', code: '旋星', color: '#b2f27d', description: '星形经过旋转器后的产物。' },
  { id: 'circle-red+square', name: '红圆叠方', code: '红圆+方', color: '#ee5d59', accent: '#f5c64f', description: '堆叠器组合出的复合图形。' },
  { id: 'diamond-blue+star', name: '蓝菱叠星', code: '蓝菱+星', color: '#568cff', accent: '#8ee86a', description: '高级堆叠目标。' },
  { id: 'trash', name: '废料', code: '废', color: '#98a2b3', description: '被回收器清理的溢出图形。' }
]

export const shapeById = Object.fromEntries(shapes.map((shape) => [shape.id, shape])) as Record<string, ShapeDefinition>