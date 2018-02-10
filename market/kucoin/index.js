#!/usr/bin/env node

const request = require('request')
const crypto = require('crypto')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const print = require('chalk-printer')
const util = require('../../lib/util')
const keyfile = require('../../lib/keyfile')
const logFile = require('../../lib/logfile')
  .setLogName('kucoin.log').clearLog()
const currentDir = path.dirname(fs.realpathSync(__filename))
const log = console.log

//@nhancv: Get config from file
const config = require('./config.json')
const targetPair = config.targetPair
const fee = config.fee
const checkFee = fee * 2

var host = 'https://api.kucoin.com'
var userEndpoint = '/v1/user/info'
//================
//MAKE REST API
function requestOrderApi(host, pairCoin, type, amount, price) {
  return new Promise(function (resolve, reject) {
    const { publicKey, secretKey } = require('./.apikey.json')

    var endpoint = `/v1/${pairCoin}/order`
    var url = host + endpoint

    var nonce = Date.now()
    /** 
     *  POST parameters：
     *    type: BUY
     *    amount: 10
     *    price: 1.1
     *    Arrange the parameters in ascending alphabetical order (lower cases first), then combine them with & (don't urlencode them, don't add ?, don't add extra &), e.g. amount=10&price=1.1&type=BUY    
     */
    var queryString = `amount=${amount}&price=${price}&type=${type}`
    //splice string for signing
    var strForSign = endpoint + '/' + nonce + '/' + queryString
    //Make a base64 encoding of the completed string
    var signatureStr = new Buffer(strForSign).toString('base64')
    //KC-API-SIGNATURE in header
    const signatureResult = crypto.createHmac('sha256', secretKey)
      .update(signatureStr)
      .digest('hex')

    request({
      method: 'POST',
      url: url,
      headers: {
        'KC-API-KEY': publicKey,
        'KC-API-NONCE': nonce,   //Client timestamp (exact to milliseconds), before using the calibration time, the server does not accept calls with a time difference of more than 3 seconds
        'KC-API-SIGNATURE': signatureResult,   //signature after client encryption
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      form: {
        'type': type,
        'amount': amount,
        'price': price
      }
    }, function (error, response, body) {
      var msg = `=> ${type} ${pairCoin} ${price} ${amount}:`
      if (error) {
        msg += chalk.red('ERROR')
        reject(error)
      } else {
        body = JSON.parse(body)
        msg += body.success ? chalk.green.bold(body.code) : chalk.red.bold(body.code)
        resolve(response)
      }
      log(msg)

    })
  })
}

function requestPrivateGetApi(host, endpoint, queryString) {
  return new Promise(function (resolve, reject) {
    const { publicKey, secretKey } = require('./.apikey.json')

    var url = host + endpoint + (util.isBlank(queryString) ? '' : '?' + queryString)
    log('Request private api: ' + url)
    var nonce = Date.now()
    /** 
     *  POST parameters：
     *    type: BUY
     *    amount: 10
     *    price: 1.1
     *    Arrange the parameters in ascending alphabetical order (lower cases first), then combine them with & (don't urlencode them, don't add ?, don't add extra &), e.g. amount=10&price=1.1&type=BUY    
     */
    var queryString = queryString === undefined ? '' : queryString
    //splice string for signing
    var strForSign = endpoint + '/' + nonce + '/' + queryString
    //Make a base64 encoding of the completed string
    var signatureStr = new Buffer(strForSign).toString('base64')
    //KC-API-SIGNATURE in header
    const signatureResult = crypto.createHmac('sha256', secretKey)
      .update(signatureStr)
      .digest('hex')

    request({
      method: 'GET',
      url: url,
      headers: {
        'KC-API-KEY': publicKey,
        'KC-API-NONCE': nonce,   //Client timestamp (exact to milliseconds), before using the calibration time, the server does not accept calls with a time difference of more than 3 seconds
        'KC-API-SIGNATURE': signatureResult,   //signature after client encryption
        'Content-Type': 'application/json'
      }
    }, function (error, response, body) {
      log(body)
      if (error) reject(error)
      else resolve(response)
    })
  })
}

function requestPublicApi(host, endpoint) {
  return new Promise(function (resolve, reject) {
    var url = host + endpoint
    // log('Request public api: ' + url)
    request({
      method: 'GET',
      url: url,
    }, function (error, response, body) {
      if (error) reject(error)
      else resolve(response)

    })
  })
}

// requestPrivateGetApi(host, userEndpoint)
///////////////////////////////////////////
/**
 * TRADING
 */
function trading(targetCoin, inputAmount) {
  return new Promise(function (resolve, reject) {
    const mapBody = response => {
      try {
        var body = JSON.parse(response.body)
        if (body.data && body.data.length > 0) {
          return Promise.resolve(body.data[0])
        } else {
          return Promise.reject('Fetching price FAILED')
        }
      } catch (error) {
        return Promise.reject(error)
      }
    }
    const mapError = error => {
      throw error
    }
    var pairZ = `${targetCoin}-ETH`
    var pairY = `${targetCoin}-BTC`
    var pairL = 'ETH-BTC'

    var getZ = requestPublicApi(host, `/v1/${pairZ}/open/orders-sell`).then(mapBody, mapError)
    var getY = requestPublicApi(host, `/v1/${pairY}/open/orders-buy`).then(mapBody, mapError)
    var getL = requestPublicApi(host, `/v1/${pairL}/open/orders-sell`).then(mapBody, mapError)

    Promise.all([getZ, getY, getL]).then(function (values) {

      var feeInputAmount = (inputAmount * (fee / 100))

      var check = true
      var ZPrice = values[0][0]
      var ZAmount = (inputAmount + feeInputAmount)
      if (ZAmount > values[0][1]) check = false

      var YPrice = values[1][0]
      var YAmount = inputAmount
      if (YAmount > values[1][1]) check = false

      var LPrice = values[2][0]
      var LAmount = (ZPrice * ZAmount)
      if (LAmount > values[2][1]) check = false

      var left = YPrice
      var right = (ZPrice * LPrice)
      var change = ((left / right - 1) * 100)
      var condition = (left > right) && check && (change > checkFee)

      var changeStr = `${change > 0 ? chalk.green.bold(change.toFixed(2)) : change < 0 ? chalk.red.bold(change.toFixed(2)) : change.toFixed(2)}%`
      var logMsg = `Trigger is ${condition ? chalk.green.bold('TRUE') : chalk.red.bold('FALSE')} - Change: ${changeStr}`
      log(logMsg)
      if (condition) {
        //Buy TargetCoin from ETH
        requestOrderApi(host, pairZ, 'BUY', ZAmount.toFixed(6), ZPrice.toFixed(8))
          .then(
            //Sell TargetCoin to BTC
            () => requestOrderApi(host, pairY, 'SELL', YAmount.toFixed(6), YPrice.toFixed(8))
          )
          .then(
            //Buy ETH from BTC
            () => requestOrderApi(host, pairL, 'BUY', LAmount.toFixed(6), LPrice.toFixed(8))
          )
          .then(() => {
            //@nhancv: Log to file
            var dataLog = `<${targetCoin}> Trigger is ${condition ? 'TRUE' : 'FALSE'} - Change: ${change.toFixed(2)}%`
              + `\r\nBUY: ${pairZ} ${ZPrice.toFixed(8)} ${ZAmount.toFixed(6)}`
              + `\r\nSELL: ${pairY} ${YPrice.toFixed(8)} ${YAmount.toFixed(6)}`
              + `\r\nBUY: ${pairL} ${LPrice.toFixed(8)} ${LAmount.toFixed(6)}`
            logFile.log(dataLog)

            return Promise.resolve()
          })
          .then(resolve, reject)
      } else {
        resolve()
      }
    }, error => { throw error })
      .catch(reject)
  })
}

/**
 * Main function
 * @param {*} index 
 */
function loop(index) {

  var targetCoin = targetPair[index].coin
  var inputAmount = targetPair[index].amount
  log(chalk.blue(`Execute pair: Coin ${chalk.yellow.bold(targetCoin)} - Amount ${inputAmount}`))

  const checkNextRun = () => {
    var nextIndex = index + 1
    var nextTimeout = 1000
    if (nextIndex == targetPair.length) {
      nextIndex = 0
      nextTimeout = 3000
      log(chalk.yellow('--------------------------------------'))
    }
    setTimeout(() => {
      loop(nextIndex)
    }, nextTimeout)
  }
  console.time('Estimate')
  trading(targetCoin, inputAmount)
    .then(() => {
      console.timeEnd('Estimate')
      checkNextRun()
    }, (error) => {
      print.error(error)
      console.timeEnd('Estimate')
      checkNextRun()
    })
}

//@nhancv: Run with process
const process = ({ publicKey, secretKey }) => {
  loop(0)
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
