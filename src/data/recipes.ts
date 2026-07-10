import type { RecipeDefinition } from '../models/factory'

export const recipes: RecipeDefinition[] = [
  {
    id: 'smelt-iron',
    name: '铁锭',
    machine: 'furnace',
    inputs: [
      { shape: 'iron-ore', amount: 1 },
      { shape: 'coal-ore', amount: 1 }
    ],
    output: 'iron-ingot',
    durationTicks: 34,
    description: '铁矿与煤矿进入熔炉后烧制为铁锭。'
  },
  {
    id: 'smelt-copper',
    name: '铜锭',
    machine: 'furnace',
    inputs: [
      { shape: 'copper-ore', amount: 1 },
      { shape: 'coal-ore', amount: 1 }
    ],
    output: 'copper-ingot',
    durationTicks: 34,
    description: '铜矿与煤矿进入熔炉后烧制为铜锭。'
  },
  {
    id: 'gear',
    name: '齿轮',
    machine: 'assembler',
    inputs: [{ shape: 'iron-ingot', amount: 2 }],
    output: 'iron-gear',
    durationTicks: 28,
    description: '两个铁锭合成为齿轮。'
  },
  {
    id: 'wire',
    name: '铜线',
    machine: 'assembler',
    inputs: [{ shape: 'copper-ingot', amount: 1 }],
    output: 'copper-wire',
    durationTicks: 22,
    description: '一个铜锭拉制为铜线。'
  },
  {
    id: 'circuit',
    name: '简易电路',
    machine: 'assembler',
    inputs: [
      { shape: 'iron-ingot', amount: 1 },
      { shape: 'copper-wire', amount: 2 }
    ],
    output: 'circuit',
    durationTicks: 42,
    description: '铁锭与铜线合成为简易电路。'
  }
]

export const recipeById = Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe])) as Record<string, RecipeDefinition>

export const furnaceRecipes = recipes.filter((recipe) => recipe.machine === 'furnace')
export const assemblerRecipes = recipes.filter((recipe) => recipe.machine === 'assembler')