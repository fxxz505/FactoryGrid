import type { BuildingDefinition } from '../models/factory'

export const buildings: BuildingDefinition[] = [
  { id: 'source-circle', name: '圆形矿脉', kind: 'source', hotkey: '1', durationTicks: 12, description: '稳定产出原始圆形。' },
  { id: 'source-square', name: '方形矿脉', kind: 'source', hotkey: '2', durationTicks: 12, description: '稳定产出原始方形。' },
  { id: 'source-star', name: '星形矿脉', kind: 'source', hotkey: '3', durationTicks: 18, description: '产出后期目标常用的星形。' },
  { id: 'source-diamond', name: '菱形矿脉', kind: 'source', hotkey: '4', durationTicks: 16, description: '产出高级堆叠与染色用菱形。' },
  { id: 'source-iron', name: '铁矿发生器', kind: 'source', hotkey: '5', durationTicks: 12, description: '测试用灰白铁矿输出。' },
  { id: 'source-coal', name: '煤矿发生器', kind: 'source', hotkey: '6', durationTicks: 12, description: '测试用黑色煤矿输出，可作为熔炉燃料。' },
  { id: 'source-copper', name: '铜矿发生器', kind: 'source', hotkey: '7', durationTicks: 12, description: '测试用棕色铜矿输出。' },
  { id: 'belt', name: '传送带', kind: 'belt', hotkey: 'B', durationTicks: 2, description: '沿当前方向运输物品，每两 tick 前进一格。' },
  { id: 'fast-belt', name: '高速传送带', kind: 'belt', hotkey: 'Q', durationTicks: 1, description: '研究解锁后使用，每 tick 前进一格。' },
  { id: 'splitter', name: '分流器', kind: 'processor', hotkey: 'F', durationTicks: 1, description: '从背面输入，在左右两侧出口之间交替分流。' },
  { id: 'merger', name: '合流器', kind: 'processor', hotkey: 'M', durationTicks: 1, description: '接收多路输入并按一个方向输出。' },
  { id: 'tunnel', name: '地下通道', kind: 'processor', hotkey: 'U', durationTicks: 1, description: '把物品跳过数格，用来跨越拥挤线路。' },
  { id: 'launcher', name: '跨线发射器', kind: 'processor', hotkey: 'J', durationTicks: 1, description: '把物品向前发射三格，适合跨越空地。' },
  { id: 'cutter', name: '切割机', kind: 'processor', hotkey: 'C', durationTicks: 18, description: '把圆形或方形切成半形。' },
  { id: 'rotator', name: '旋转器', kind: 'processor', hotkey: 'T', durationTicks: 14, description: '旋转星形，其他图形直接通过。' },
  { id: 'painter-red', name: '红色染色器', kind: 'processor', hotkey: 'P', durationTicks: 20, description: '把圆形染成红色。' },
  { id: 'painter-blue', name: '蓝色染色器', kind: 'processor', hotkey: 'L', durationTicks: 20, description: '把方形或菱形染成蓝色。' },
  { id: 'painter-green', name: '绿色染色器', kind: 'processor', hotkey: 'G', durationTicks: 20, description: '把星形染成绿色。' },
  { id: 'stacker', name: '堆叠器', kind: 'processor', hotkey: 'K', durationTicks: 24, description: '把兼容图形组合成复合目标。' },
  { id: 'furnace', name: '熔炉', kind: 'processor', hotkey: 'V', durationTicks: 34, description: '从任一输入端接收兼容原料，烧制铁锭、铜锭或钢材。' },
  { id: 'assembler', name: '合成器', kind: 'processor', hotkey: 'A', durationTicks: 28, description: '双击后选择配方，将输入物料合成新产物。' },
  { id: 'research-lab', name: '研究中心', kind: 'processor', hotkey: 'Y', durationTicks: 18, description: '接收研究包，双击选择研究项目并逐包推进。' },
  { id: 'trash', name: '回收器', kind: 'processor', hotkey: 'X', durationTicks: 1, description: '删除输入物品，用于清理堵塞。' },
  { id: 'hub', name: '枢纽', kind: 'hub', hotkey: 'H', durationTicks: 1, description: '接收最终产品并统计交付，不再直接推进研究。' }
]

export const buildingById = Object.fromEntries(buildings.map((building) => [building.id, building])) as Record<string, BuildingDefinition>
