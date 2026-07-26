# ScrASCII

An ASCII Scratch renderer; for the terminal!

<img width="1675" height="845" alt="Screenshot_20260726_042821" src="https://github.com/user-attachments/assets/5ecd264e-b946-46ae-ad52-0f86c8ccbf0e" />
<sup>This image symbolizes the utter stupidity of the Scratch community /j</sup>

## Features

- ASCII renderer
- Unicode half-block renderer
- ANSI and True Color support!
- Sound playback through your speakers, via [node-web-audio-api](https://github.com/ircam-ismm/node-web-audio-api)
- Runs local `.sb3` projects with [scratch-vm](https://github.com/OmniBlocks/monorepo/tree/main/scratch-vm)
- Mouse support: click sprites/the stage, and drag draggable sprites, right in the terminal. On terminals that don't support mouse reporting, arrow keys move a virtual cursor (space/enter to click, tab to grab/drop)
- Keyboard support: type to drive "when [key] key pressed" hats and "key [key] pressed?" checks. Terminals only report key-down, so a key is treated as released after a short pause with no repeats

## Usage

```sh
node src/index.js path/to/project.sb3
node src/index.js --demo
```

Run `node src/index.js --help` for rendering and playback options. Pass `--mute` to disable audio, or `--no-mouse` to disable mouse/virtual-cursor input entirely.

Extensions and pen are not rendered.

# License

MPL-2.0. If you need to see it look at [LICENSE](./LICENSE)
