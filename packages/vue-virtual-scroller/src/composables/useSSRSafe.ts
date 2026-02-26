import type { UseSSRSafeReturn } from '../types/composables'
import { onMounted, ref } from 'vue'

export function useSSRSafe(): UseSSRSafeReturn {
  const isClient = ref(false)
  const isServer = ref(true)

  onMounted(() => {
    isClient.value = true
    isServer.value = false
  })

  const onClientSide = (callback: () => void) => {
    if (isClient.value) {
      callback()
    }
  }

  const onServerSide = (callback: () => void) => {
    if (isServer.value) {
      callback()
    }
  }

  return {
    isClient,
    isServer,
    onClientSide,
    onServerSide,
  }
}
