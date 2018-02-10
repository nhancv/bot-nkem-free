const path = require('path')
const fs = require('fs')
const os = require('os')

var logName = 'data.log'
var logDir = process.cwd()
var logPath = `${logDir}/${logName}`
var tag = 'INFO'

function updateLogPath() {
  logPath = `${logDir}/${logName}`
}
function setTag(newTag) {
  tag = newTag
  return this
}

function setLogName(newLogName) {
  logName = newLogName
  updateLogPath()
  return this
}

function setLogDir(newLogDir) {
  logDir = newLogDir
  updateLogPath()
  return this
}

function clearLog() {
  if (fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '')
  }
  return this
}

function log(data) {
  var template = `${new Date().toISOString()} [${tag}]: ${data}${os.EOL}`
  fs.appendFileSync(logPath, template)
  return this
}

///////////////////
/**
 * EXPORT
 * Usage: 
 * const logFile = require('../../lib/logfile')
 * logFile.setTag('Test').setLogName('hello.log').setLogDir(__dirname).clearLog().log('hello').log('hello2')
 */
module.exports = {
  setTag,
  setLogName,
  setLogDir,
  clearLog,
  log
}