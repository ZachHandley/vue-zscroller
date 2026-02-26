export interface Config {
  itemsLimit: number
  installComponents?: boolean
  componentsPrefix?: string
}

const defaultConfig: Config = {
  itemsLimit: 1000,
}

export default defaultConfig
