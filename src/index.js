#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { consola } from 'consola'

yargs()
  .scriptName('scrascii')
  .usage('$0 <cmd> [args]')
  .command(
    'hello [name]',
    'welcome ter yargs!',
    (yargs) => {
      yargs.positional('name', {
        type: 'string',
        default: 'Cambi',
        describe: 'the name to say hello to',
      })
    },
    function (argv) {
      consola.log('hello', argv.name, 'welcome to yargs!')
    },
  )
  .help()
  .parse(hideBin(process.argv))
