const ENABLE_MOUSE = '\x1b[?1003h\x1b[?1006h'
const DISABLE_MOUSE = '\x1b[?1003l\x1b[?1006l'

const SGR_MOUSE_RE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/

/**
 * Captures terminal mouse-tracking reports and raw keyboard
 * bytes from stdin
 */
export class TerminalInput {
  constructor({ input = process.stdin, output = process.stdout } = {}) {
    this.input = input
    this.output = output
    this.handlers = new Set()
    this.started = false
    this._onData = this._onData.bind(this)
  }

  onEvent(handler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  start() {
    if (this.started) return
    this.started = true

    if (this.input.isTTY) this.input.setRawMode(true)
    this.input.resume()
    this.input.setEncoding('utf8')
    this.output.write(ENABLE_MOUSE)
    this.input.on('data', this._onData)
  }

  stop() {
    if (!this.started) return
    this.started = false

    this.input.off('data', this._onData)
    this.output.write(DISABLE_MOUSE)
    if (this.input.isTTY) this.input.setRawMode(false)
    this.input.pause()
  }

  _onData(chunk) {
    let rest = chunk

    while (rest.length > 0) {
      const match = SGR_MOUSE_RE.exec(rest)
      if (match) {
        const [full, cb, col, row, suffix] = match
        this._emitMouse(Number(cb), Number(col), Number(row), suffix === 'M')
        rest = rest.slice(full.length)
        continue
      }

      const nextEscape = rest.indexOf('\x1b', 1)
      const literal = nextEscape === -1 ? rest : rest.slice(0, nextEscape)
      if (literal) this._emit({ kind: 'key', value: literal })
      rest = nextEscape === -1 ? '' : rest.slice(nextEscape)
    }
  }

  _emitMouse(cb, col, row, isPress) {
    const isMotion = (cb & 32) !== 0
    const buttonBits = cb & 3
    const button = buttonBits === 3 ? null : buttonBits

    let type
    if (!isPress) type = 'up'
    else if (isMotion) type = button === null ? 'move' : 'drag'
    else type = 'down'

    this._emit({ kind: 'mouse', type, button, col: col - 1, row: row - 1 })
  }

  _emit(event) {
    for (const handler of this.handlers) handler(event)
  }
}
