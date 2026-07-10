import type { ResearchDefinition, ShapeId } from '../models/factory'

export const researchPointValues: Partial<Record<ShapeId, number>> = {
  'iron-plate': 1,
  'copper-wire': 1,
  'iron-gear': 2,
  circuit: 4,
  steel: 5,
  motor: 10
}

export const researchDefinitions: ResearchDefinition[] = [
  {
    id: 'logistics-engineering',
    name: '物流工程',
    description: '解锁高速传送带，让主干物流达到每 tick 一格。',
    cost: 20,
    prerequisites: [],
    requirements: [
      { shape: 'iron-plate', amount: 8 },
      { shape: 'copper-wire', amount: 8 }
    ],
    unlockBuildings: ['fast-belt']
  },
  {
    id: 'automation-upgrade',
    name: '自动化升级',
    description: '解锁升级规划器，并允许生产机器提升至 2 级。',
    cost: 40,
    prerequisites: ['logistics-engineering'],
    requirements: [
      { shape: 'iron-gear', amount: 8 },
      { shape: 'circuit', amount: 4 }
    ],
    maxMachineLevel: 2
  },
  {
    id: 'metallurgy-automation',
    name: '冶金自动化',
    description: '解锁电机配方，建立齿轮与电路的高级生产闭环。',
    cost: 70,
    prerequisites: ['automation-upgrade'],
    requirements: [
      { shape: 'steel', amount: 8 },
      { shape: 'circuit', amount: 8 }
    ],
    unlockRecipes: ['motor']
  },
  {
    id: 'mass-production',
    name: '规模化生产',
    description: '允许生产机器提升至 3 级，进一步压缩加工节拍。',
    cost: 100,
    prerequisites: ['metallurgy-automation'],
    requirements: [
      { shape: 'motor', amount: 4 },
      { shape: 'steel', amount: 12 }
    ],
    maxMachineLevel: 3
  }
]

export const researchById = Object.fromEntries(
  researchDefinitions.map((research) => [research.id, research])
) as Record<string, ResearchDefinition>
