import { reactive } from 'vue'

export interface IdStateOptions {
  idProp?: string | ((vm: any) => string | number)
}

export interface IdStateComponent {
  idState: any
  $_id: string | number | null
  $_getId: () => string | number
  $_idStateInit: (id: string | number) => any
  $_updateIdState: () => void
  $options: any
  $nextTick: (callback: () => void) => void
  $watch: (exp: string | Function, options: any) => void
}

interface VueComponentWithIdState extends IdStateComponent {
  [key: string]: any
}

export default function ({
  idProp = (vm: any) => vm.item.id,
}: IdStateOptions = {}) {
  const store = reactive<Record<string, any>>({})

  // @vue/component
  return {
    data() {
      return {
        idState: null,
      }
    },

    created() {
      const vm = this as VueComponentWithIdState
      vm.$_id = null
      if (typeof idProp === 'function') {
        vm.$_getId = () => idProp.call(vm, vm)
      }
      else {
        vm.$_getId = () => vm[idProp as string]
      }
      vm.$watch(vm.$_getId, {
        handler(value: string | number) {
          vm.$nextTick(() => {
            vm.$_id = value
          })
        },
        immediate: true,
      })
      vm.$_updateIdState()
    },

    beforeUpdate() {
      const vm = this as VueComponentWithIdState
      vm.$_updateIdState()
    },

    methods: {
      /**
       * Initialize an idState
       * @param {number|string} id Unique id for the data
       */
      $_idStateInit(id: string | number): any {
        const vm = this as VueComponentWithIdState
        const factory = vm.$options.idState
        if (typeof factory === 'function') {
          const data = factory.call(vm, vm)
          store[id] = data
          vm.$_id = id
          return data
        }
        else {
          throw new TypeError('[mixin IdState] Missing `idState` function on component definition.')
        }
      },

      /**
       * Ensure idState is created and up-to-date
       */
      $_updateIdState(): void {
        const vm = this as VueComponentWithIdState
        const id = vm.$_getId()
        if (id == null) {
          console.warn(`No id found for IdState with idProp: '${idProp}'.`)
        }
        if (id !== vm.$_id) {
          if (!store[id]) {
            vm.$_idStateInit(id)
          }
          vm.idState = store[id]
        }
      },
    },
  } as unknown as IdStateComponent
}