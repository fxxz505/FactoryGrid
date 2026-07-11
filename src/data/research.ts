import type { ResearchDefinition } from '../models/factory'

export const researchDefinitions: ResearchDefinition[] = [
  {
    id: 'logistics-engineering', name: '物流工程',
    description: '消耗物流研究包，解锁高速传送带。', cost: 10, durationTicks: 18,
    prerequisites: [], requirements: [{ shape: 'logistics-pack', amount: 10 }], unlockBuildings: ['fast-belt']
  },
  {
    id: 'automation-upgrade', name: '自动化升级',
    description: '消耗自动化研究包，解锁升级规划器并开放 2 级机器。', cost: 12, durationTicks: 20,
    prerequisites: ['logistics-engineering'], requirements: [{ shape: 'automation-pack', amount: 12 }], maxMachineLevel: 2
  },
  {
    id: 'metallurgy-automation', name: '冶金自动化',
    description: '消耗冶金研究包，解锁电机、轴承与钢制框架。', cost: 12, durationTicks: 22,
    prerequisites: ['automation-upgrade'], requirements: [{ shape: 'metallurgy-pack', amount: 12 }],
    unlockRecipes: ['motor', 'bearing', 'steel-frame']
  },
  {
    id: 'advanced-electronics', name: '高级电子学',
    description: '消耗电子研究包，解锁处理器与机器人研究包。', cost: 14, durationTicks: 24,
    prerequisites: ['automation-upgrade'], requirements: [{ shape: 'electronics-pack', amount: 14 }],
    unlockRecipes: ['processor', 'robotics-pack']
  },
  {
    id: 'robotics', name: '机器人技术',
    description: '消耗机器人研究包，解锁伺服机构与核心研究包。', cost: 16, durationTicks: 26,
    prerequisites: ['metallurgy-automation', 'advanced-electronics'], requirements: [{ shape: 'robotics-pack', amount: 16 }],
    unlockRecipes: ['servo', 'core-pack']
  },
  {
    id: 'automation-core', name: '自动化核心',
    description: '消耗核心研究包，解锁自动化核心和效用研究包。', cost: 18, durationTicks: 28,
    prerequisites: ['robotics'], requirements: [{ shape: 'core-pack', amount: 18 }],
    unlockRecipes: ['automation-core', 'utility-pack']
  },
  {
    id: 'mass-production', name: '规模化生产',
    description: '消耗效用研究包，开放 3 级机器、极速传送带与高级物流升级。', cost: 20, durationTicks: 30,
    prerequisites: ['automation-core'], requirements: [{ shape: 'utility-pack', amount: 20 }],
    unlockBuildings: ['express-belt'], maxMachineLevel: 3
  }
]

export const researchById = Object.fromEntries(
  researchDefinitions.map((research) => [research.id, research])
) as Record<string, ResearchDefinition>
