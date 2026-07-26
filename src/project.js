import './env.js'

import { readFile } from 'node:fs/promises'

import Storage from 'scratch-storage'
import VirtualMachine from 'scratch-vm'

import { NodeBitmapAdapter } from './bitmap-adapter.js'
import { TerminalRenderer } from './renderer.js'

export const STAGE_WIDTH = 480
export const STAGE_HEIGHT = 360

export function createVm({ pixelWidth = STAGE_WIDTH, pixelHeight = STAGE_HEIGHT } = {}) {
  const vm = new VirtualMachine()
  const renderer = new TerminalRenderer({ width: pixelWidth, height: pixelHeight })

  vm.attachStorage(new Storage())
  vm.attachV2BitmapAdapter(new NodeBitmapAdapter())
  vm.attachRenderer(renderer)

  return { vm, renderer }
}

export async function loadProjectFile(vm, filePath) {
  const buffer = await readFile(filePath)
  await vm.loadProject(buffer)
}

/**
 * Waits until every running thread has settled
 */
export function waitForThreadsIdle(vm, { pollMs = 50 } = {}) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const threads = vm.runtime.threads
      let active = 0
      for (const thread of threads) {
        if (!thread.updateMonitor) active += 1
      }
      if (active === 0) {
        clearInterval(interval)
        resolve()
      }
    }, pollMs)
  })
}
