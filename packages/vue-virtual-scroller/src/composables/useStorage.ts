import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'

export interface UseStorageOptions<T> {
  deep?: boolean
  writeDefaults?: boolean
  mergeDefaults?: boolean
  shallow?: boolean
  window?: Window & typeof globalThis
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: UseStorageOptions<T> = {}
): Ref<T> {
  return useStorage(key, defaultValue, localStorage, options)
}

export function useSessionStorage<T>(
  key: string,
  defaultValue: T,
  options: UseStorageOptions<T> = {}
): Ref<T> {
  return useStorage(key, defaultValue, sessionStorage, options)
}

export function useStorage<T>(
  key: string,
  defaultValue: T,
  storage: Storage,
  options: UseStorageOptions<T> = {}
): Ref<T> {
  const {
    deep = true,
    writeDefaults = true,
    mergeDefaults = false,
    shallow = false,
    window = globalThis.window
  } = options

  const data = ref<T>(defaultValue)

  const read = () => {
    try {
      const rawValue = storage.getItem(key)
      if (rawValue != null) {
        return JSON.parse(rawValue)
      }
    } catch (e) {
      // Ignore parse errors
    }
    return defaultValue
  }

  const write = (value: T) => {
    try {
      if (value === undefined) {
        storage.removeItem(key)
      } else {
        storage.setItem(key, JSON.stringify(value))
      }
    } catch (e) {
      // Ignore write errors (e.g., quota exceeded)
    }
  }

  // Read initial value
  if (typeof window !== 'undefined') {
    data.value = read()
  }

  // Watch for changes and write to storage
  const stopWatch = watch(
    data,
    (newValue) => {
      write(newValue)
    },
    { deep }
  )

  // Listen for storage events from other windows/tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === key && e.storageArea === storage) {
      try {
        data.value = e.newValue ? JSON.parse(e.newValue) : defaultValue
      } catch (e) {
        // Ignore parse errors
        data.value = defaultValue
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage)
  }

  onUnmounted(() => {
    stopWatch()
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage)
    }
  })

  return data as Ref<T>
}