import { describe, expect, it } from 'vitest'
import { addItem, hasIngredients, removeIngredients } from '../../src/utils/inventory'

describe('inventory utilities', () => {
  it('adds and removes recipe ingredients without mutating the original inventory', () => {
    const original = { iron_plate: 3 }
    const updated = addItem(original, 'gear', 2)
    const consumed = removeIngredients(updated, [{ resource: 'iron_plate', amount: 2 }])

    expect(original).toEqual({ iron_plate: 3 })
    expect(updated).toEqual({ iron_plate: 3, gear: 2 })
    expect(consumed).toEqual({ iron_plate: 1, gear: 2 })
  })

  it('checks ingredient availability for multi-input recipes', () => {
    expect(
      hasIngredients(
        { iron_plate: 1, wire: 2 },
        [
          { resource: 'iron_plate', amount: 1 },
          { resource: 'wire', amount: 2 }
        ]
      )
    ).toBe(true)

    expect(
      hasIngredients(
        { iron_plate: 1, wire: 1 },
        [
          { resource: 'iron_plate', amount: 1 },
          { resource: 'wire', amount: 2 }
        ]
      )
    ).toBe(false)
  })
})
