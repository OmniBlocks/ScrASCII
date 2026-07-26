#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { consola } from 'consola'

import { TerminalRenderer } from './renderer.js'
import { renderRgba } from './output.js'

const STAGE_WIDTH = 480
const STAGE_HEIGHT = 360

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

const argv = yargs(hideBin(process.argv))
  .scriptName('scrascii')
  .usage('$0 [options]')
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
  .help()
  .parse()

if (argv.demo) {
  runDemo(argv)
} else {
  consola.log('Nothing to do. Try --demo to test the rendering pipeline, or --help.')
}
