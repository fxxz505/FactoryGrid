import type { ShapeDefinition } from '../models/factory'

export const shapes: ShapeDefinition[] = [
  { id: 'circle', name: '圆形', code: '圆', color: '#65c7f7', description: '来自圆形矿脉的基础图形。' },
  { id: 'square', name: '方形', code: '方', color: '#f5c64f', description: '用于切割、染色与堆叠的基础图形。' },
  { id: 'star', name: '星形', code: '星', color: '#8ee86a', description: '高级目标常用图形。' },
  { id: 'diamond', name: '菱形', code: '菱', color: '#c690ff', description: '高级生产线中的装饰图形。' },
  { id: 'iron-ore', name: '铁矿', code: '铁矿', color: '#d7ddd9', description: '灰白色圆形矿物，可与煤矿在熔炉中烧制。' },
  { id: 'coal-ore', name: '煤矿', code: '煤', color: '#242424', description: '黑色圆形燃料，供熔炉烧制使用。' },
  { id: 'copper-ore', name: '铜矿', code: '铜矿', color: '#a66a3f', description: '棕色圆形矿物，可与煤矿在熔炉中烧制。' },
  { id: 'iron-ingot', name: '铁锭', code: '铁锭', color: '#cfd6d3', description: '铁矿烧制后的银色三角形产物。' },
  { id: 'copper-ingot', name: '铜锭', code: '铜锭', color: '#b87445', description: '铜矿烧制后的棕色三角形产物。' },
  { id: 'iron-plate', name: '铁板', code: '铁板', color: '#dce2df', description: '由铁锭压制成的浅银色工业材料。' },
  { id: 'steel', name: '钢材', code: '钢', color: '#8f9ca2', description: '铁锭与煤矿再次烧制得到的高级冶金材料。' },
  { id: 'iron-gear', name: '齿轮', code: '齿', color: '#aeb8b4', description: '由两块铁板合成的机械传动件。' },
  { id: 'copper-wire', name: '铜线', code: '铜线', color: '#d0894d', description: '合成器将铜锭拉制成的导线。' },
  { id: 'circuit', name: '电路', code: '电路', color: '#4fa186', description: '由铁板与铜线合成的自动化元件。' },
  { id: 'motor', name: '电机', code: '电机', color: '#3f8f98', description: '齿轮与电路组合成的高级工业产品。' },
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
