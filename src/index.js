#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { consola } from 'consola'

import { TerminalRenderer } from './renderer.js'
import { renderRgba } from './output.js'

const STAGE_WIDTH = 480
const STAGE_HEIGHT = 360

const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'
const CLEAR_SCREEN = '\x1b[2J\x1b[H'
const CURSOR_HOME = '\x1b[H'
const CLEAR_TO_END = '\x1b[0J'

function makeCheckerboardImage(width, height, cellSize, colorA, colorB) {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isA = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0
      const color = isA ? colorA : colorB
      const i = (y * width + x) * 4
      data[i] = color[0]
      data[i + 1] = color[1]
      data[i + 2] = color[2]
      data[i + 3] = 255
    }
  }

  return { width, height, data }
}

function makeGradientImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = Math.round((x / (width - 1)) * 255)
      data[i + 1] = Math.round((y / (height - 1)) * 255)
      data[i + 2] = 128
      data[i + 3] = 255
    }
  }

  return { width, height, data }
}

function runDemo({ columns, rows, mode }) {
  const renderer = new TerminalRenderer({ width: 240, height: 180 })

  const backdropSkin = renderer.createBitmapSkin(
    makeCheckerboardImage(STAGE_WIDTH, STAGE_HEIGHT, 40, [40, 40, 60], [70, 70, 100]),
  )
  const backdrop = renderer.createDrawable('background')
  renderer.updateDrawablePosition(backdrop, [0, 0])
  renderer.updateDrawableDirectionScale(backdrop, 90, [100, 100])
  renderer.updateDrawableVisible(backdrop, true)
  renderer.updateDrawableSkinId(backdrop, backdropSkin)

  const spriteSkin = renderer.createBitmapSkin(makeGradientImage(100, 100))
  const sprite = renderer.createDrawable('sprite')
  renderer.updateDrawablePosition(sprite, [60, -20])
  renderer.updateDrawableDirectionScale(sprite, 90, [150, 150])
  renderer.updateDrawableVisible(sprite, true)
  renderer.updateDrawableSkinId(sprite, spriteSkin)

  const frame = renderer.renderFrame([0, 0, 0, 255])
  const output = renderRgba(frame, renderer.width, renderer.height, { mode, columns, rows })

  process.stdout.write(`${output}\n`)
}

async function runProject(projectPath, { columns, rows, mode, fps, duration, mute }) {
  // Deferred
  const { createVm, loadProjectFile } = await import('./project.js')

  const { vm, renderer } = createVm({ pixelWidth: STAGE_WIDTH, pixelHeight: STAGE_HEIGHT, mute })

  const captions = new Map()
  vm.runtime.on('SAY', (target, type, text) => {
    const name = target.getName ? target.getName() : target.sprite.name
    if (text === '') {
      captions.delete(name)
    } else {
      captions.set(name, { type, text })
    }
  })

  consola.start(`Loading ${projectPath}`)
  await loadProjectFile(vm, projectPath)
  consola.success(
    `Loaded. Targets: ${vm.runtime.targets
      .filter((t) => !t.isStage)
      .map((t) => t.getName())
      .join(', ')}`,
  )

  process.stdout.write(CLEAR_SCREEN + HIDE_CURSOR)

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    vm.stopAll()
    vm.quit()
    vm.runtime.audioEngine?.audioContext.close()
    process.stdout.write(`${SHOW_CURSOR}\n`)
    process.exit(0)
  }
  process.on('SIGINT', stop)

  const draw = () => {
    const frame = renderer.renderFrame([255, 255, 255, 255])
    const output = renderRgba(frame, renderer.width, renderer.height, { mode, columns, rows })
    const captionLines = [...captions.entries()]
      .map(([name, { type, text }]) => `${name} ${type === 'think' ? 'thinks' : 'says'}: ${text}`)
      .join('\n')

    process.stdout.write(CURSOR_HOME + output + '\n' + captionLines + CLEAR_TO_END)
  }

  vm.start()
  vm.greenFlag()
  const timer = setInterval(draw, 1000 / fps)

  if (duration) {
    setTimeout(stop, duration * 1000)
  }
}

const argv = yargs(hideBin(process.argv))
  .scriptName('scrascii')
  .usage('$0 [project] [options]')
  .positional('project', {
    type: 'string',
    describe: 'path to a local .sb3 file to run and render',
  })
  .option('demo', {
    type: 'boolean',
    default: false,
    describe: 'render a synthetic test scene to check the rendering pipeline',
  })
  .option('columns', {
    type: 'number',
    default: 80,
    describe: 'output width in terminal columns',
  })
  .option('rows', {
    type: 'number',
    default: 40,
    describe: 'output height in terminal rows',
  })
  .option('mode', {
    type: 'string',
    default: 'unicode-truecolor',
    choices: ['ascii-ansi', 'ascii-truecolor', 'unicode-ansi', 'unicode-truecolor'],
    describe: 'rendering mode',
  })
  .option('fps', {
    type: 'number',
    default: 10,
    describe: 'terminal redraw rate when running a project',
  })
  .option('duration', {
    type: 'number',
    describe: 'stop after this many seconds (default: run until Ctrl+C)',
  })
  .option('mute', {
    type: 'boolean',
    default: false,
    describe: 'disable audio playback',
  })
  .help()
  .parse()

const [project] = argv._

if (project) {
  runProject(project, argv).catch((error) => {
    consola.error(error)
    process.exitCode = 1
  })
} else if (argv.demo) {
  runDemo(argv)
} else {
  consola.log(
    'Nothing to do. Pass a project path to run it, --demo to test the rendering pipeline, or --help.',
  )
}
