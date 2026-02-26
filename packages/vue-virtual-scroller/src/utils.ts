export interface EventListenerOptions {
  passive?: boolean
  capture?: boolean
  once?: boolean
}

let _supportsPassive = false

export function supportsPassive(): boolean {
  return _supportsPassive
}

if (typeof window !== 'undefined') {
  _supportsPassive = false
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get() {
        _supportsPassive = true
      },
    }) as EventListenerOptions

    window.addEventListener('test', null as any, opts)
  }
  catch {
    // noop
  }
}
