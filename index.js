#!/usr/bin/env node

const program = require('commander')
const format = require('string-format-js')
const fs = require('fs')
const clear = require('clear')
const figlet = require('figlet')
const minimist = require('minimist')
const _ = require('lodash')
const chalk = require('chalk')
const print = require('chalk-printer')
const files = require('./lib/file')

const log = console.log
//@nhancv: Wellcome text
clear()
log(
  chalk.yellow(
    figlet.textSync('nkem', { horizontalLayout: 'full' })
  )
)

//@nhancv: Generate module command
const getDirectories = source =>
  fs.readdirSync(source)
    .filter(name => name !== '.DS_Store')

const source = `${files.getDirectoryBase()}/market`
var modules = getDirectories(source)

modules.forEach(name => {
  program
    .command(name)
    .option('-k, --key', 'Update key', /\s/g, true)
    .option('-c, --config', 'Locate of config file', /\s/g, true)
    .action(function (command) {
      var module = source + '/' + name
      try {
        require(module).main(command)
      } catch (error) {
        log(error.message)
      }
    })
})

program
  .version(require('./package.json').version, '-v, --version')
  .parse(process.argv)

//@nhancv: Make help option is default
if (!process.argv.slice(2).length) {
  program.outputHelp(chalk.hex('#ED5323'))
}
