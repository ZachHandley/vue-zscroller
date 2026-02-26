import type { Ref } from 'vue'
import type { UseIdStateOptions, UseIdStateReturn } from '../types/composables'
import { onBeforeUpdate, onMounted, reactive, ref, useId, watch } from 'vue'

export function useIdState<T = any>(
  options: UseIdStateOptions<T> = {},
): UseIdStateReturn<T> {
  const {
    idProp = vm => vm.item?.id,
    initialState = () => ({}),
  } = options

  // Generate stable ID using Vue's useId for fallback
  const stableId = useId()
  const store = reactive<Record<string | number, T>>({})
  const idState: Ref<T | null> = ref(null)
  const currentId = ref<string | number | null>(null)
  const vm = ref<any>(null)

  const getId = (): string | number => {
    if (!vm.value)
      return stableId

    if (typeof idProp === 'function') {
      const id = idProp(vm.value)
      return id ?? stableId
    }

    return vm.value[idProp] ?? stableId
  }

  const initIdState = (id: string | number) => {
    const data = initialState() as T
    store[id] = data
    currentId.value = id
    idState.value = data
    return data
  }

  const updateIdState = () => {
    const id = getId()

    // useId ensures we always have a valid ID, so no need for null check warning
    if (id !== currentId.value) {
      if (!store[id]) {
        initIdState(id)
      }
      else {
        currentId.value = id
        idState.value = store[id]
      }
    }
  }

  const reset = () => {
    if (currentId.value && store[currentId.value]) {
      const initialStateData = initialState() as T
      Object.assign(store[currentId.value] as object, initialStateData)
    }
  }

  // Setup watchers and lifecycle hooks
  const setup = (componentInstance: any) => {
    vm.value = componentInstance

    watch(getId, (newId) => {
      if (newId !== currentId.value) {
        updateIdState()
      }
    }, { immediate: true })

    onMounted(() => {
      updateIdState()
    })

    onBeforeUpdate(() => {
      updateIdState()
    })
  }

  return {
    idState,
    updateIdState,
    reset,
    setup,
  }
}
