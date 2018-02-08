const request = require('request')
const crypto = require('crypto')
const apiKey = require('./.apikey.json')
const log = console.log

var host = "https://api.kucoin.com"
var userEndpoint = "/v1/user/info"

var targetCoin = "ETC"

var pairZ = `${targetCoin}-ETH`
var pairY = `${targetCoin}-BTC`
var pairL = "ETH-BTC"

//================
//MAKE REST API
function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}

function requestOrderApi(host, endpoint, type, amount, price) {
    return new Promise(function (resolve, reject) {
        var url = host + endpoint
        log(`Request order ${type} ${amount} ${price}: ${url}`)
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
            log(`=> Response ${endpoint} ${type} ${amount} ${price}: ${body}`)
            if (error) reject(error)
            else resolve(response)
        })
    })
}

function requestPrivateGetApi(host, endpoint, queryString) {
    return new Promise(function (resolve, reject) {
        var url = host + endpoint + (isBlank(queryString) ? "" : "?" + queryString)
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
    })
}

function requestPublicApi(host, endpoint) {
    return new Promise(function (resolve, reject) {
        var url = host + endpoint
        log("Request public api: " + url)
        request({
            method: "GET",
            url: url,
        }, function (error, response, body) {
            if (error) reject(error)
            else resolve(response)

        })
    })
}

// requestPrivateGetApi(host, userEndpoint)

var fee = 0.001 //0.1%
var getZ = requestPublicApi(host, `/v1/${pairZ}/open/orders-sell`).then(function (response) {
    var body = JSON.parse(response.body)
    return Promise.resolve(body.data[0]) //Buy TargetCoin from ETH
})
var getY = requestPublicApi(host, `/v1/${pairY}/open/orders-buy`).then(function (response) {
    var body = JSON.parse(response.body)
    return Promise.resolve(body.data[0]) //Sell TargetCoin to BTC
})
var getL = requestPublicApi(host, `/v1/${pairL}/open/orders-sell`).then(function (response) {
    var body = JSON.parse(response.body)
    return Promise.resolve(body.data[0]) //Buy ETH from BTC
})

Promise.all([getZ, getY, getL]).then(function (values) {
    console.log(values);

    var inputAmount = 1 //TargetCoin

    var ZPrice = values[0][0]
    var ZAmount = Math.min(inputAmount, values[0][1]).toFixed(6)
    var YPrice = values[1][0]
    var YAmount = Math.min(inputAmount, values[1][1]).toFixed(6)
    var LPrice = values[2][0]
    var LAmount = Math.min(ZPrice * ZAmount, values[2][1]).toFixed(6)

    var left = YPrice.toFixed(6)
    var right = (ZPrice * LPrice * (1 - fee)).toFixed(6)
    var change = ((right / left - 1) * 100).toFixed(2)
    var condition = left < right
    log(`Condition 'Y < Z x L x (1-fee)' is ${condition} [Left: ${left}; Right: ${right}]; Change: ${change}%`)
    if (condition) {
        //Buy TargetCoin from ETH
        requestOrderApi(host, `/v1/${pairZ}/order`, "BUY", ZAmount, ZPrice)
            .then(
            //Sell TargetCoin to BTC
            requestOrderApi(host, `/v1/${pairY}/order`, "SELL", YAmount, YPrice)
            )
            .then(
            //Buy ETH from BTC
            requestOrderApi(host, `/v1/${pairL}/order`, "BUY", LAmount, LPrice)
            )

    }
});

