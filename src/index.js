#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { consola } from 'consola'

import { TerminalRenderer } from './renderer.js'
import { renderRgba, cellToPixel, pixelToCell } from './output.js'
import { TerminalInput } from './input.js'

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

const KEY_CURSOR_STEP = 8
const CURSOR_GLYPH = '\x1b[7m*\x1b[0m'

// Terminals never report key-up
const KEY_RELEASE_DELAY = 600

const TERMINAL_KEY_MAP = {
  '\x1b[A': 'ArrowUp',
  '\x1b[B': 'ArrowDown',
  '\x1b[C': 'ArrowRight',
  '\x1b[D': 'ArrowLeft',
  '\x1b[3~': 'Delete',
  '\r': 'Enter',
  '\n': 'Enter',
  '\t': 'Tab',
  '\x1b': 'Escape',
  '\x7f': 'Backspace',
  '\b': 'Backspace',
}

function terminalKeyToDomKey(value) {
  if (value in TERMINAL_KEY_MAP) return TERMINAL_KEY_MAP[value]
  // A lone printable character
  if (value.length === 1 && value.charCodeAt(0) >= 32) return value
  return null
}

function setupInput(vm, renderer, { columns, rows, mode, enabled }) {
  const cursor = { x: renderer.width / 2, y: renderer.height / 2, visible: false }
  let drag = null
  const keyTimers = new Map()

  const sendKey = (key, isDown) => vm.postIOData('keyboard', { key, isDown })

  const keyDown = (domKey) => {
    const existing = keyTimers.get(domKey)
    if (existing) clearTimeout(existing)
    sendKey(domKey, true)
    keyTimers.set(
      domKey,
      setTimeout(() => {
        keyTimers.delete(domKey)
        sendKey(domKey, false)
      }, KEY_RELEASE_DELAY),
    )
  }

  const releaseAllKeys = () => {
    for (const [domKey, timer] of keyTimers) {
      clearTimeout(timer)
      sendKey(domKey, false)
    }
    keyTimers.clear()
  }

  const send = (x, y, extra = {}) =>
    vm.postIOData('mouse', {
      x,
      y,
      canvasWidth: renderer.width,
      canvasHeight: renderer.height,
      ...extra,
    })

  const beginDrag = (x, y) => {
    const drawableId = renderer.pick(x, y)
    if (drawableId === null) return null
    const targetId = vm.getTargetIdForDrawableId(drawableId)
    const target = targetId && vm.runtime.getTargetById(targetId)
    if (!target || !target.draggable) return null

    target.goToFront()
    const mouse = vm.runtime.ioDevices.mouse
    vm.startDrag(targetId)
    return {
      targetId,
      offsetX: target.x - mouse.getScratchX(),
      offsetY: target.y - mouse.getScratchY(),
    }
  }

  const updateDrag = (x, y) => {
    send(x, y)
    const mouse = vm.runtime.ioDevices.mouse
    vm.postSpriteInfo({
      x: mouse.getScratchX() + drag.offsetX,
      y: mouse.getScratchY() + drag.offsetY,
      force: true,
    })
  }

  const endDrag = () => {
    vm.stopDrag(drag.targetId)
    drag = null
  }

  const moveCursorTo = (x, y) => {
    cursor.x = x
    cursor.y = y
    if (drag) updateDrag(x, y)
    else send(x, y)
  }

  const moveCursorBy = (dx, dy) => {
    cursor.visible = true
    moveCursorTo(
      Math.max(0, Math.min(renderer.width - 1, cursor.x + dx)),
      Math.max(0, Math.min(renderer.height - 1, cursor.y + dy)),
    )
  }

  const clickPulse = () => {
    cursor.visible = true
    send(cursor.x, cursor.y, { isDown: true, button: 0 })
    send(cursor.x, cursor.y, { isDown: false, button: 0 })
  }

  const toggleGrab = () => {
    cursor.visible = true
    if (drag) endDrag()
    else drag = beginDrag(cursor.x, cursor.y) ?? drag
  }

  const handleKey = (value, stop) => {
    if (value.includes('')) return stop()

    const domKey = terminalKeyToDomKey(value)
    if (domKey) keyDown(domKey)

    switch (value) {
      case '\x1b[A':
        return moveCursorBy(0, -KEY_CURSOR_STEP)
      case '\x1b[B':
        return moveCursorBy(0, KEY_CURSOR_STEP)
      case '\x1b[C':
        return moveCursorBy(KEY_CURSOR_STEP, 0)
      case '\x1b[D':
        return moveCursorBy(-KEY_CURSOR_STEP, 0)
      case ' ':
      case '\r':
      case '\n':
        return clickPulse()
      case '\t':
        return toggleGrab()
      default:
        return
    }
  }

  const handleMouse = (event) => {
    cursor.visible = false
    const col = Math.max(0, Math.min(columns - 1, event.col))
    const row = Math.max(0, Math.min(rows - 1, event.row))
    const [x, y] = cellToPixel(col, row, {
      columns,
      rows,
      mode,
      width: renderer.width,
      height: renderer.height,
    })
    cursor.x = x
    cursor.y = y

    if (event.type === 'move') {
      send(x, y)
    } else if (event.type === 'down') {
      send(x, y, { isDown: true, button: event.button ?? 0 })
      drag = beginDrag(x, y) ?? drag
    } else if (event.type === 'drag') {
      if (drag) updateDrag(x, y)
      else send(x, y)
    } else if (event.type === 'up') {
      const wasDragged = Boolean(drag)
      if (drag) endDrag()
      send(x, y, { isDown: false, button: event.button ?? 0, wasDragged })
    }
  }

  const input = enabled ? new TerminalInput() : null

  return {
    cursor,
    start(stop) {
      if (!input) return
      input.onEvent((event) => {
        if (event.kind === 'mouse') handleMouse(event)
        else if (event.kind === 'key') handleKey(event.value, stop)
      })
      input.start()
    },
    stop() {
      releaseAllKeys()
      input?.stop()
    },
    overlay() {
      if (!cursor.visible) return ''
      const [col, row] = pixelToCell(cursor.x, cursor.y, {
        columns,
        rows,
        width: renderer.width,
        height: renderer.height,
      })
      return `\x1b[${row + 1};${col + 1}H${CURSOR_GLYPH}`
    },
  }
}

async function runProject(projectPath, { columns, rows, mode, fps, duration, mute, mouse }) {
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
  // Interpolation disabled
  vm.runtime.setInterpolation(false)
  consola.success(
    `Loaded. Targets: ${vm.runtime.targets
      .filter((t) => !t.isStage)
      .map((t) => t.getName())
      .join(', ')}`,
  )

  process.stdout.write(CLEAR_SCREEN + HIDE_CURSOR)

  const input = setupInput(vm, renderer, { columns, rows, mode, enabled: mouse })

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    input.stop()
    vm.stopAll()
    vm.quit()
    vm.runtime.audioEngine?.audioContext.close()
    process.stdout.write(`${SHOW_CURSOR}\n`)
    process.exit(0)
  }
  process.on('SIGINT', stop)
  input.start(stop)

  const draw = () => {
    const frame = renderer.renderFrame([255, 255, 255, 255])
    const output = renderRgba(frame, renderer.width, renderer.height, { mode, columns, rows })
    const captionLines = [...captions.entries()]
      .map(([name, { type, text }]) => `${name} ${type === 'think' ? 'thinks' : 'says'}: ${text}`)
      .join('\n')

    process.stdout.write(
      CURSOR_HOME + output + '\n' + captionLines + CLEAR_TO_END + input.overlay(),
    )
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
  .option('mouse', {
    type: 'boolean',
    default: true,
    describe:
      'enable terminal input: mouse clicks/drags on sprites, keyboard keys for "when key pressed"/"key down?", and (when mouse reporting is unsupported) arrow keys to move a virtual cursor, space/enter to click, and tab to grab/drop',
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
