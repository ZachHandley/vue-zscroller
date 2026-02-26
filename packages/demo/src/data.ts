import { faker } from '@faker-js/faker'

let uid = 0

interface GeneratedItem {
  name: string
  avatar: string
}

export interface DataItem {
  id: number
  index: number
  type: 'letter' | 'person'
  value: string | GeneratedItem
  height: number
}

export interface MessageItem {
  avatar: string
  message: string
}

function generateItem(): GeneratedItem {
  return {
    name: faker.name.fullName(),
    avatar: 'https://picsum.photos/50/50',
  }
}

export function getData(count: number, letters: boolean): DataItem[] {
  const raw: Record<string, GeneratedItem[]> = {}

  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('')

  for (const l of alphabet) {
    raw[l] = []
  }

  for (let i = 0; i < count; i++) {
    const item = generateItem()
    const letter = item.name.charAt(0).toLowerCase()
    raw[letter].push(item)
  }

  const list: DataItem[] = []
  let index = 1

  for (const l of alphabet) {
    raw[l] = raw[l].sort((a, b) => a.name < b.name ? -1 : 1)
    if (letters) {
      list.push({
        id: uid++,
        index: index++,
        type: 'letter',
        value: l,
        height: 200,
      })
    }
    for (const item of raw[l]) {
      list.push({
        id: uid++,
        index: index++,
        type: 'person',
        value: item,
        height: 50,
      })
    }
  }

  return list
}

export function addItem(list: DataItem[]): void {
  list.push({
    id: uid++,
    index: list.length + 1,
    type: 'person',
    value: generateItem(),
    height: 50,
  })
}

export function generateMessage(): MessageItem {
  return {
    avatar: 'https://picsum.photos/50/50',
    message: faker.lorem.text(),
  }
}
