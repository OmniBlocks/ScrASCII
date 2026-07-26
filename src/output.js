const ASCII_RAMP = ' .:-=+*#%@'

const ESC = '\x1b['
const RESET = `${ESC}0m`
const UPPER_HALF_BLOCK = '▀'

const ALPHA_THRESHOLD = 16

function bandBounds(index, count, size) {
  const start = Math.floor((index * size) / count)
  const end = Math.max(start + 1, Math.floor(((index + 1) * size) / count))
  return [start, end]
}

function averageRegion(rgba, width, x0, x1, y0, y1) {
  let r = 0
  let g = 0
  let b = 0
  let a = 0

  for (let y = y0; y < y1; y++) {
    const rowOffset = y * width
    for (let x = x0; x < x1; x++) {
      const i = (rowOffset + x) * 4
      r += rgba[i]
      g += rgba[i + 1]
      b += rgba[i + 2]
      a += rgba[i + 3]
    }
  }

  const count = (x1 - x0) * (y1 - y0)
  return [r / count, g / count, b / count, a / count]
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function rgbToAnsi256(r, g, b) {
  if (Math.round(r) === Math.round(g) && Math.round(g) === Math.round(b)) {
    if (r < 8) return 16
    if (r > 248) return 231
    return Math.round(((r - 8) / 247) * 24) + 232
  }

  const ri = Math.round((r / 255) * 5)
  const gi = Math.round((g / 255) * 5)
  const bi = Math.round((b / 255) * 5)
  return 16 + 36 * ri + 6 * gi + bi
}

function fgCode(r, g, b, truecolor) {
  return truecolor
    ? `${ESC}38;2;${Math.round(r)};${Math.round(g)};${Math.round(b)}m`
    : `${ESC}38;5;${rgbToAnsi256(r, g, b)}m`
}

function bgCode(r, g, b, truecolor) {
  return truecolor
    ? `${ESC}48;2;${Math.round(r)};${Math.round(g)};${Math.round(b)}m`
    : `${ESC}48;5;${rgbToAnsi256(r, g, b)}m`
}

function renderAscii(rgba, width, height, columns, rows, truecolor) {
  const lines = []

  for (let row = 0; row < rows; row++) {
    const [y0, y1] = bandBounds(row, rows, height)
    let line = ''
    let lastCode = null

    for (let col = 0; col < columns; col++) {
      const [x0, x1] = bandBounds(col, columns, width)
      const [r, g, b, a] = averageRegion(rgba, width, x0, x1, y0, y1)

      if (a < ALPHA_THRESHOLD) {
        if (lastCode !== RESET) {
          line += RESET
          lastCode = RESET
        }
        line += ' '
        continue
      }

      const glyph = ASCII_RAMP[Math.round((luminance(r, g, b) / 255) * (ASCII_RAMP.length - 1))]
      const code = fgCode(r, g, b, truecolor)
      if (code !== lastCode) {
        line += code
        lastCode = code
      }
      line += glyph
    }

    line += RESET
    lines.push(line)
  }

  return lines.join('\n')
}

function renderUnicode(rgba, width, height, columns, rows, truecolor) {
  const lines = []
  const subRows = rows * 2

  for (let row = 0; row < rows; row++) {
    const [yTop0, yTop1] = bandBounds(row * 2, subRows, height)
    const [yBottom0, yBottom1] = bandBounds(row * 2 + 1, subRows, height)
    let line = ''
    let lastFg = null
    let lastBg = null

    for (let col = 0; col < columns; col++) {
      const [x0, x1] = bandBounds(col, columns, width)
      const top = averageRegion(rgba, width, x0, x1, yTop0, yTop1)
      const bottom = averageRegion(rgba, width, x0, x1, yBottom0, yBottom1)

      const topVisible = top[3] >= ALPHA_THRESHOLD
      const bottomVisible = bottom[3] >= ALPHA_THRESHOLD

      if (!topVisible && !bottomVisible) {
        if (lastFg !== RESET) {
          line += RESET
          lastFg = RESET
          lastBg = RESET
        }
        line += ' '
        continue
      }

      const [tr, tg, tb] = topVisible ? top : bottom
      const [br, bg, bb] = bottomVisible ? bottom : top

      const fg = fgCode(tr, tg, tb, truecolor)
      const bg2 = bgCode(br, bg, bb, truecolor)

      if (fg !== lastFg) {
        line += fg
        lastFg = fg
      }
      if (bg2 !== lastBg) {
        line += bg2
        lastBg = bg2
      }
      line += UPPER_HALF_BLOCK
    }

    line += RESET
    lines.push(line)
  }

  return lines.join('\n')
}

export function renderRgba(rgba, width, height, { mode, columns, rows }) {
  switch (mode) {
    case 'ascii-ansi':
      return renderAscii(rgba, width, height, columns, rows, false)
    case 'ascii-truecolor':
      return renderAscii(rgba, width, height, columns, rows, true)
    case 'unicode-ansi':
      return renderUnicode(rgba, width, height, columns, rows, false)
    case 'unicode-truecolor':
      return renderUnicode(rgba, width, height, columns, rows, true)
    default:
      throw new Error(`Unknown render mode: ${mode}`)
  }
}
