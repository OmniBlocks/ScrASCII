import { Resvg } from '@resvg/resvg-js'

export class TerminalRenderer {
  constructor({ width, height }) {
    // pixel resolution
    this.width = width
    this.height = height

    this.nextDrawableId = 0
    this.nextSkinId = 0

    this.drawables = new Map()
    this.skins = new Map()
    this.drawOrder = []
  }

  createDrawable(layerGroup) {
    const id = this.nextDrawableId++

    this.drawables.set(id, {
      id,
      layerGroup,
      x: 0,
      y: 0,
      direction: 90,
      scale: [100, 100],
      visible: true,
      skinId: null,
      effects: Object.create(null),
    })

    this.drawOrder.push(id)
    return id
  }

  destroyDrawable(id) {
    this.drawables.delete(id)
    this.drawOrder = this.drawOrder.filter((drawableId) => drawableId !== id)
  }

  createBitmapSkin(image, resolution = 1, rotationCenter) {
    const id = this.nextSkinId++
    const center = rotationCenter ?? [image.width / 2, image.height / 2]

    this.skins.set(id, {
      type: 'bitmap',
      width: image.width / resolution,
      height: image.height / resolution,
      sourceWidth: image.width,
      sourceHeight: image.height,
      pixels: image.data,
      resolution,
      rotationCenter: center,
    })

    return id
  }

  createSVGSkin(svgText, rotationCenter) {
    const resvg = new Resvg(svgText, { fitTo: { mode: 'original' } })
    const rendered = resvg.render()
    const { width, height } = rendered
    const pixels = rendered.pixels
    const data = new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength)

    return this.createBitmapSkin({ width, height, data }, 1, rotationCenter)
  }

  createTextSkin(type, text, onSpriteRight) {
    const id = this.nextSkinId++
    this.skins.set(id, {
      type: 'text',
      width: 0,
      height: 0,
      rotationCenter: [0, 0],
      bubbleType: type,
      text,
      onSpriteRight,
    })
    return id
  }

  updateTextSkin(skinId, type, text, onSpriteRight) {
    const skin = this.skins.get(skinId)
    if (skin) {
      skin.bubbleType = type
      skin.text = text
      skin.onSpriteRight = onSpriteRight
    }
  }

  destroySkin(skinId) {
    this.skins.delete(skinId)
  }

  getSkinSize(skinId) {
    const skin = this.skins.get(skinId)
    return skin ? [skin.width, skin.height] : [0, 0]
  }

  getSkinRotationCenter(skinId) {
    const skin = this.skins.get(skinId)
    return skin ? skin.rotationCenter : [0, 0]
  }

  getCurrentSkinSize(drawableId) {
    const drawable = this.drawables.get(drawableId)
    return drawable?.skinId !== null ? this.getSkinSize(drawable.skinId) : [0, 0]
  }

  updateDrawablePosition(id, [x, y]) {
    const drawable = this.drawables.get(id)
    if (drawable) {
      drawable.x = x
      drawable.y = y
    }
  }

  updateDrawableDirectionScale(id, direction, scale) {
    const drawable = this.drawables.get(id)
    if (drawable) {
      drawable.direction = direction
      drawable.scale = scale
    }
  }

  updateDrawableVisible(id, visible) {
    const drawable = this.drawables.get(id)
    if (drawable) drawable.visible = visible
  }

  updateDrawableSkinId(id, skinId) {
    const drawable = this.drawables.get(id)
    if (drawable) drawable.skinId = skinId
  }

  updateDrawableEffect(id, effect, value) {
    const drawable = this.drawables.get(id)
    if (drawable) drawable.effects[effect] = value
  }

  getFencedPositionOfDrawable(_id, [x, y]) {
    return [Math.max(-240, Math.min(240, x)), Math.max(-180, Math.min(180, y))]
  }

  setDrawableOrder(id, order, _layerGroup, relative = false) {
    const current = this.drawOrder.indexOf(id)
    if (current === -1) return -1

    this.drawOrder.splice(current, 1)

    let nextIndex
    if (order === Infinity) {
      nextIndex = this.drawOrder.length
    } else if (order === -Infinity) {
      nextIndex = 0
    } else if (relative) {
      nextIndex = current + order
    } else {
      nextIndex = order
    }

    nextIndex = Math.max(0, Math.min(this.drawOrder.length, nextIndex))
    this.drawOrder.splice(nextIndex, 0, id)
    return nextIndex
  }

  getDrawableOrder(id) {
    return this.drawOrder.indexOf(id)
  }

  getBounds(id) {
    const drawable = this.drawables.get(id)
    const skin = drawable && this.skins.get(drawable.skinId)
    if (!drawable || !skin) return null

    const scaleX = Math.abs(drawable.scale[0]) / 100
    const scaleY = Math.abs(drawable.scale[1]) / 100
    const width = skin.width * scaleX
    const height = skin.height * scaleY

    return {
      left: drawable.x - width / 2,
      right: drawable.x + width / 2,
      bottom: drawable.y - height / 2,
      top: drawable.y + height / 2,
    }
  }

  getBoundsForBubble(id) {
    return this.getBounds(id)
  }

  getNativeSize() {
    return [480, 360]
  }

  setStageSize() {}

  setUseHighQualityRender() {}

  setLayerGroupOrdering() {}

  draw() {}

  pick(x, y) {
    for (let i = this.drawOrder.length - 1; i >= 0; i--) {
      const id = this.drawOrder[i]
      const drawable = this.drawables.get(id)
      const skin = drawable && this.skins.get(drawable.skinId)
      if (!drawable?.visible || !skin || skin.type !== 'bitmap') continue
      if (this.#sampleAlpha(drawable, skin, x, y) > 0) return id
    }
    return null
  }

  drawableTouching(id, x, y) {
    const drawable = this.drawables.get(id)
    const skin = drawable && this.skins.get(drawable.skinId)
    if (!drawable?.visible || !skin || skin.type !== 'bitmap') return false
    return this.#sampleAlpha(drawable, skin, x, y) > 0
  }

  isTouchingColor() {
    return false
  }

  isTouchingDrawables(drawableId, candidateIds = this.drawOrder) {
    const drawable = this.drawables.get(drawableId)
    const skin = drawable && this.skins.get(drawable.skinId)
    if (!drawable?.visible || !skin || skin.type !== 'bitmap') return false

    for (const candidateId of candidateIds) {
      const candidate = this.drawables.get(candidateId)
      const candidateSkin = candidate && this.skins.get(candidate.skinId)
      if (!candidate?.visible || !candidateSkin || candidateSkin.type !== 'bitmap') continue
      if (this.#drawablesOverlap(drawable, skin, candidate, candidateSkin)) return true
    }
    return false
  }

  #drawablesOverlap(drawableA, skinA, drawableB, skinB) {
    const a = this.#skinGeometry(drawableA, skinA)
    const b = this.#skinGeometry(drawableB, skinB)

    const left = Math.max(a.left, b.left, 0)
    const right = Math.min(a.left + a.outputWidth, b.left + b.outputWidth, this.width)
    const top = Math.max(a.top, b.top, 0)
    const bottom = Math.min(a.top + a.outputHeight, b.top + b.outputHeight, this.height)

    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (
          this.#sampleAlpha(drawableA, skinA, x, y) > 0 &&
          this.#sampleAlpha(drawableB, skinB, x, y) > 0
        ) {
          return true
        }
      }
    }
    return false
  }

  renderFrame(background = [255, 255, 255, 255]) {
    const frame = new Uint8ClampedArray(this.width * this.height * 4)

    for (let i = 0; i < frame.length; i += 4) {
      frame[i] = background[0]
      frame[i + 1] = background[1]
      frame[i + 2] = background[2]
      frame[i + 3] = background[3]
    }

    for (const drawableId of this.drawOrder) {
      const drawable = this.drawables.get(drawableId)
      const skin = drawable && this.skins.get(drawable.skinId)

      if (!drawable?.visible || !skin || skin.type !== 'bitmap') continue

      this.#blitSkin(frame, drawable, skin)
    }

    return frame
  }

  #skinGeometry(drawable, skin) {
    const flipX = drawable.scale[0] < 0
    const scaleX = Math.abs(drawable.scale[0]) / 100
    const scaleY = Math.abs(drawable.scale[1]) / 100

    // scale skins down to the terminal renderer's own framebuffer resolution.
    const stageScaleX = this.width / 480
    const stageScaleY = this.height / 360

    const outputWidth = Math.max(1, Math.round(skin.width * scaleX * stageScaleX))
    const outputHeight = Math.max(1, Math.round(skin.height * scaleY * stageScaleY))

    // Scratch (0, 0) is stage center; terminal pixels begin top-left.
    const originX = ((drawable.x + 240) / 480) * this.width
    const originY = ((180 - drawable.y) / 360) * this.height

    // drawable.x/y anchors the skin's rotation center, which usually isn't
    // its geometric middle (e.g. a costume's feet, or an off-center prop),
    // so offset by how far that point sits from the image's own edges.
    const rotationOffsetX = skin.rotationCenter[0] * scaleX * stageScaleX
    const rotationOffsetY = skin.rotationCenter[1] * scaleY * stageScaleY

    const left = Math.round(originX - (flipX ? outputWidth - rotationOffsetX : rotationOffsetX))
    const top = Math.round(originY - rotationOffsetY)

    return { outputWidth, outputHeight, left, top, flipX }
  }

  #sampleAlpha(drawable, skin, x, y) {
    const { outputWidth, outputHeight, left, top, flipX } = this.#skinGeometry(drawable, skin)

    const dx = Math.round(x) - left
    const dy = Math.round(y) - top
    if (dx < 0 || dx >= outputWidth || dy < 0 || dy >= outputHeight) return 0

    let sx = Math.min(skin.sourceWidth - 1, Math.floor((dx / outputWidth) * skin.sourceWidth))
    if (flipX) sx = skin.sourceWidth - 1 - sx
    const sy = Math.min(skin.sourceHeight - 1, Math.floor((dy / outputHeight) * skin.sourceHeight))

    return skin.pixels[(sy * skin.sourceWidth + sx) * 4 + 3]
  }

  #blitSkin(frame, drawable, skin) {
    const { outputWidth, outputHeight, left, top, flipX } = this.#skinGeometry(drawable, skin)

    for (let dy = 0; dy < outputHeight; dy++) {
      const y = top + dy
      if (y < 0 || y >= this.height) continue

      const sy = Math.min(
        skin.sourceHeight - 1,
        Math.floor((dy / outputHeight) * skin.sourceHeight),
      )

      for (let dx = 0; dx < outputWidth; dx++) {
        const x = left + dx
        if (x < 0 || x >= this.width) continue

        let sx = Math.min(skin.sourceWidth - 1, Math.floor((dx / outputWidth) * skin.sourceWidth))
        if (flipX) sx = skin.sourceWidth - 1 - sx

        const sourceOffset = (sy * skin.sourceWidth + sx) * 4
        const destinationOffset = (y * this.width + x) * 4

        const alpha = skin.pixels[sourceOffset + 3] / 255
        if (alpha === 0) continue

        frame[destinationOffset] = Math.round(
          skin.pixels[sourceOffset] * alpha + frame[destinationOffset] * (1 - alpha),
        )
        frame[destinationOffset + 1] = Math.round(
          skin.pixels[sourceOffset + 1] * alpha + frame[destinationOffset + 1] * (1 - alpha),
        )
        frame[destinationOffset + 2] = Math.round(
          skin.pixels[sourceOffset + 2] * alpha + frame[destinationOffset + 2] * (1 - alpha),
        )
        frame[destinationOffset + 3] = 255
      }
    }
  }
}
