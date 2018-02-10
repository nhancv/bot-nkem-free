#!/usr/bin/env node

const print = require('chalk-printer')
const path = require('path')
const fs = require('fs')
const keyfile = require('../../lib/keyfile')
const log = console.log
const currentDir = path.dirname(fs.realpathSync(__filename))

//@nhancv: Run with process
const process = ({publicKey, secretKey}) => {
  
}

//@nhancv: Run with command
const run = (command) => {
  keyfile.gen(currentDir, command.key)
    .then(() => {
      process(require('./.apikey.json'))
    }, () => { })
}

/**
 * EXPORT
 */
module.exports = {
  main: function (command) {
    try {
      run(command)
    } catch (err) {
      print.error(err)
    }
  }
}
