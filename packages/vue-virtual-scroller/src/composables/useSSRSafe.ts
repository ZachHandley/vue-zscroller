import { ref, onMounted } from 'vue'
import type { UseSSRSafeReturn } from '../types/composables'

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
    onServerSide
  }
}