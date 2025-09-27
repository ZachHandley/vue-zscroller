export interface CommonProps {
  items: any[]
  keyField?: string
  direction?: 'vertical' | 'horizontal'
  listTag?: string
  itemTag?: string
}

export const props = {
  items: {
    type: Array as () => any[],
    required: true,
  },

  keyField: {
    type: String,
    default: 'id',
  },

  direction: {
    type: String as () => 'vertical' | 'horizontal',
    default: 'vertical',
    validator: (value: string) => ['vertical', 'horizontal'].includes(value),
  },

  listTag: {
    type: String,
    default: 'div',
  },

  itemTag: {
    type: String,
    default: 'div',
  },
}

export function simpleArray(this: CommonProps): boolean {
  return this.items.length > 0 && typeof this.items[0] !== 'object'
}