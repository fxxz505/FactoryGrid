export type CountRecord = Record<string, number>

export interface CountIngredient {
  resource: string
  amount: number
}

export function cloneInventory(inventory: CountRecord): CountRecord {
  return { ...inventory }
}

export function getAmount(inventory: CountRecord, resource: string): number {
  return inventory[resource] ?? 0
}

export function addItem(inventory: CountRecord, resource: string, amount: number): CountRecord {
  return { ...inventory, [resource]: getAmount(inventory, resource) + amount }
}

export function removeItem(inventory: CountRecord, resource: string, amount: number): CountRecord {
  return { ...inventory, [resource]: Math.max(0, getAmount(inventory, resource) - amount) }
}

export function hasIngredients(inventory: CountRecord, ingredients: CountIngredient[]): boolean {
  return ingredients.every((ingredient) => getAmount(inventory, ingredient.resource) >= ingredient.amount)
}

export function addIngredients(inventory: CountRecord, ingredients: CountIngredient[]): CountRecord {
  return ingredients.reduce((next, ingredient) => addItem(next, ingredient.resource, ingredient.amount), inventory)
}

export function removeIngredients(inventory: CountRecord, ingredients: CountIngredient[]): CountRecord {
  return ingredients.reduce((next, ingredient) => removeItem(next, ingredient.resource, ingredient.amount), inventory)
}

export function inventoryTotal(inventory: CountRecord): number {
  return Object.values(inventory).reduce((sum, amount) => sum + amount, 0)
}
