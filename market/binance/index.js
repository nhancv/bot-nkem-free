#!/usr/bin/env node

const print = require('chalk-printer')
const path = require('path')
const fs = require('fs')
const keyfile = require('../../lib/keyfile')
const logFile = require('../../lib/logfile')
  .setLogName('binance.log').clearLog()

const log = console.log
const currentDir = path.dirname(fs.realpathSync(__filename))

//@nhancv: Run with process
const process = ({ publicKey, secretKey }) => {
  log({ publicKey, secretKey })
  
}

//@nhancv: Run with command
const run = (command) => {
  keyfile.gen(currentDir, command.key)
    .then(() => {
      process(require('./.apikey.json'))
    }, (error) => { throw error })
    .catch((error) => {
      print.error(error)
    })
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
