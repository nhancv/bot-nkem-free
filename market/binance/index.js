#!/usr/bin/env node

const print = require('chalk-printer')
const path = require('path')
const fs = require('fs')
const moment = require('moment')
const keyfile = require('../../lib/keyfile')
const logFile = require('nlogj')
  .setLogName(`binance.${moment().format('YYYYMMDD_HHmm')}.log`).clearLog()

const log = console.log
const currentDir = path.dirname(fs.realpathSync(__filename))

//@nhancv: Run with process
const process = ({ publicKey, secretKey }) => {
  print.ok('In pro version only')
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
