#!/usr/bin/env node

const request = require('request')
const crypto = require('crypto')
const chalk = require('chalk')
const util = require('./market/util')
const apiKey = require('./.apikey.json')

const log = console.log

var host = "https://api.kucoin.com"
var userEndpoint = "/v1/user/info"

const targetPair = [
    { coin: "ETC", amount: 0.1 },
    { coin: "NEO", amount: 0.1 },
    { coin: "KCS", amount: 2 },
    { coin: "RPX", amount: 10 },
    { coin: "OCN", amount: 100 },
    { coin: "TKY", amount: 100 },
    { coin: "OMG", amount: 1 },
    { coin: "BCH", amount: 0.01 },
]

const fee = 0.1 //0.1%
const checkFee = 0.21 //0.21%
const remainFee = 1 - fee / 100
const futureFee = 1 + fee / 100

//================
//MAKE REST API
function requestOrderApi(host, pairCoin, type, amount, price) {
    return new Promise(function (resolve, reject) {
        var endpoint = `/v1/${pairCoin}/order`
        var url = host + endpoint

        // log(`Request order ${type} ${amount} ${price}: ${url}`)
        var publicKey = apiKey.Key
        var secret = apiKey.Secret //The secret assigned when the API created
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
        var strForSign = endpoint + "/" + nonce + "/" + queryString
        //Make a base64 encoding of the completed string
        var signatureStr = new Buffer(strForSign).toString('base64')
        //KC-API-SIGNATURE in header
        const signatureResult = crypto.createHmac('sha256', secret)
            .update(signatureStr)
            .digest('hex')

        request({
            method: "POST",
            url: url,
            headers: {
                "KC-API-KEY": publicKey,
                "KC-API-NONCE": nonce,   //Client timestamp (exact to milliseconds), before using the calibration time, the server does not accept calls with a time difference of more than 3 seconds
                "KC-API-SIGNATURE": signatureResult,   //signature after client encryption
                "Content-Type": "application/x-www-form-urlencoded"
            },
            form: {
                "type": type,
                "amount": amount,
                "price": price
            }
        }, function (error, response, body) {
            var msg = `=> ${type} ${pairCoin} ${price} ${amount}:`
            if (error) {
                msg += chalk.red("ERROR")
                reject(error)
            } else {
                body = JSON.parse(body)
                msg += body.success ? chalk.green.bold(body.code) : chalk.red.bold(body.code)
                resolve(response)
            }
            log(msg)

        })
    }).catch(() => {})
}

function requestPrivateGetApi(host, endpoint, queryString) {
    return new Promise(function (resolve, reject) {
        var url = host + endpoint + (util.isBlank(queryString) ? "" : "?" + queryString)
        log("Request private api: " + url)
        var publicKey = apiKey.Key
        var secret = apiKey.Secret //The secret assigned when the API created
        var nonce = Date.now()
        /** 
         *  POST parameters：
         *    type: BUY
         *    amount: 10
         *    price: 1.1
         *    Arrange the parameters in ascending alphabetical order (lower cases first), then combine them with & (don't urlencode them, don't add ?, don't add extra &), e.g. amount=10&price=1.1&type=BUY    
         */
        var queryString = queryString === undefined ? "" : queryString
        //splice string for signing
        var strForSign = endpoint + "/" + nonce + "/" + queryString
        //Make a base64 encoding of the completed string
        var signatureStr = new Buffer(strForSign).toString('base64')
        //KC-API-SIGNATURE in header
        const signatureResult = crypto.createHmac('sha256', secret)
            .update(signatureStr)
            .digest('hex')

        request({
            method: "GET",
            url: url,
            headers: {
                "KC-API-KEY": publicKey,
                "KC-API-NONCE": nonce,   //Client timestamp (exact to milliseconds), before using the calibration time, the server does not accept calls with a time difference of more than 3 seconds
                "KC-API-SIGNATURE": signatureResult,   //signature after client encryption
                "Content-Type": "application/json"
            }
        }, function (error, response, body) {
            log(body)
            if (error) reject(error)
            else resolve(response)
        })
    }).catch(() => {})
}

function requestPublicApi(host, endpoint) {
    return new Promise(function (resolve, reject) {
        var url = host + endpoint
        // log("Request public api: " + url)
        request({
            method: "GET",
            url: url,
        }, function (error, response, body) {
            if (error) reject(error)
            else resolve(response)

        })
    }).catch(() => {})
}

// requestPrivateGetApi(host, userEndpoint)
///////////////////////////////////////////
/**
 * PROCESSING
 */
function processing(pairZ, pairY, pairL, inputAmount) {
    return new Promise(function (resolve, reject) {
        var getZ = requestPublicApi(host, `/v1/${pairZ}/open/orders-sell`).then(function (response) {
            var body = JSON.parse(response.body)
            return Promise.resolve(body.data[0]) //Buy TargetCoin from ETH
        }).catch(() => {})
        var getY = requestPublicApi(host, `/v1/${pairY}/open/orders-buy`).then(function (response) {
            var body = JSON.parse(response.body)
            return Promise.resolve(body.data[0]) //Sell TargetCoin to BTC
        }).catch(() => {})
        var getL = requestPublicApi(host, `/v1/${pairL}/open/orders-sell`).then(function (response) {
            var body = JSON.parse(response.body)
            return Promise.resolve(body.data[0]) //Buy ETH from BTC
        }).catch(() => {})

        Promise.all([getZ, getY, getL]).then(function (values) {
            var check = true;
            var ZPrice = values[0][0].toFixed(8)
            var ZAmount = inputAmount.toFixed(6)
            if (ZAmount > values[0][1]) check = false

            var YPrice = values[1][0].toFixed(8)
            var YAmount = (inputAmount * remainFee).toFixed(6)
            if (YAmount > values[1][1]) check = false

            var LPrice = values[2][0].toFixed(8)
            var LAmount = (ZPrice * ZAmount * futureFee).toFixed(6)
            if (LAmount > values[2][1]) check = false

            var left = YPrice
            var right = (ZPrice * LPrice).toFixed(8)
            var change = ((left / right - 1) * 100).toFixed(2)
            var condition = (left > right) && check && (change > checkFee)
            log(`Trigger is ${condition ? chalk.green.bold("TRUE") : chalk.red.bold("FALSE")} - Change: ${change > 0 ? chalk.green.bold(change) : change < 0 ? chalk.red.bold(change) : change}%`)
            if (condition) {
                //Buy TargetCoin from ETH
                requestOrderApi(host, pairZ, "BUY", ZAmount, ZPrice)
                    .then(
                        //Sell TargetCoin to BTC
                        requestOrderApi(host, pairY, "SELL", YAmount, YPrice)
                    )
                    .then(
                        //Buy ETH from BTC
                        requestOrderApi(host, pairL, "BUY", LAmount, LPrice)
                    )
                    .then(resolve())
                    .catch(reject)
            } else {
                resolve()
            }

        }).catch(() => {})
    }).catch(() => {});
}

/**
 * Main function
 * @param {*} index 
 */
function main(index) {

    var targetCoin = targetPair[index].coin
    var inputAmount = targetPair[index].amount
    log(chalk.blue(`Execute pair: Coin ${chalk.yellow.bold(targetCoin)} - Amount ${inputAmount}`))

    var pairZ = `${targetCoin}-ETH`
    var pairY = `${targetCoin}-BTC`
    var pairL = "ETH-BTC"

    console.time('Estimate')
    processing(pairZ, pairY, pairL, inputAmount)
        .then(() => {
            console.timeEnd('Estimate')

            var nextIndex = index + 1
            var nextTimeout = 1000
            if (nextIndex == targetPair.length) {
                nextIndex = 0
                nextTimeout = 3000
                log(chalk.yellow("--------------------------------------"))
            }
            setTimeout(() => {
                main(nextIndex)
            }, nextTimeout)
        }, (error) => {
            console.error(error)
        })
}

//EXECUTE MAIN
try {
    main(0)    
} catch (error) {
    console.error(error)
}
