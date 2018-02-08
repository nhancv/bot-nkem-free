const request = require('request')
const crypto = require('crypto')
const apiKey = require('./.apikey.json')
const log = console.log

var host = "https://api.kucoin.com"
var userEndpoint = "/v1/user/info"


var kucoinSymbols = [
    "KCS-ETH",
    "KCS-BTC",
    "ETH-BTC",
]
var symbolActive = kucoinSymbols[0]
var orderBooksEndpoint = "/v1/" + symbolActive + "/open/orders" //public
var tickEndpoint = "/v1/" + symbolActive + "/open/tick" //public
var marketFavouriteSymbols = "/v1/market/fav-symbols" //["KCS-BTC","ETH-BTC","NEO-BTC","KCS-ETH","NEO-ETH"]

var endpoint = tickEndpoint  // API endpoint

//================
//MAKE REST API
function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}

function requestOrderApi(host, endpoint, type, amount, price) {
    return new Promise(function (resolve, reject) {
        var url = host + endpoint
        log("Request order api: " + url)
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
            if (error) {
                log(error)
            } else {
                log('Status:', response.statusCode)
                log('Headers:', JSON.stringify(response.headers))
                log('Response:', body)
            }
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
            if (error) {
                log(error)
            } else {
                log('Status:', response.statusCode)
                log('Headers:', JSON.stringify(response.headers))
                log('Response:', body)
            }
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
            // if (error) {
            //     log(error)
            // } else {
            //     log('Status:', response.statusCode)
            //     log('Headers:', JSON.stringify(response.headers))
            //     log('Response:', body)
            // }
            if (error) reject(error)
            else resolve(response)

        })
    })
}

// requestPrivateGetApi(host, userEndpoint)

var fee = 0.001 //0.1%
var getZ = requestPublicApi(host, "/v1/KCS-ETH/open/orders-sell").then(function (response) {
    var body = JSON.parse(response.body)
    return Promise.resolve(body.data[0]) //Buy KCS from ETH
})
var getY = requestPublicApi(host, "/v1/KCS-BTC/open/orders-buy").then(function (response) {
    var body = JSON.parse(response.body)
    return Promise.resolve(body.data[0]) //Sell KCS to BTC
})
var getL = requestPublicApi(host, "/v1/ETH-BTC/open/orders-sell").then(function (response) {
    var body = JSON.parse(response.body)
    return Promise.resolve(body.data[0]) //Buy ETH from BTC
})

Promise.all([getZ, getY, getL]).then(function (values) {
    console.log(values);

    var inputAmount = 2 //KCS

    var ZPrice = values[0][0]
    var ZAmount = Math.min(inputAmount, values[0][1]).toFixed(2)
    var YPrice = values[1][0]
    var YAmount = Math.min(inputAmount, values[1][1]).toFixed(2)
    var LPrice = values[2][0]
    var LAmount = Math.min(ZPrice * ZAmount, values[2][1]).toFixed(2)

    var left = YPrice.toFixed(6)
    var right = (ZPrice * LPrice * (1 - fee)).toFixed(6)
    var change = ((right / left - 1) * 100).toFixed(2)
    var condition = left < right
    log(`Condition 'Y < Z x L x (1-fee)' is ${condition} [Left: ${left}; Right: ${right}]; Change: ${change}%`)
    if (condition) {
        //Buy KCS from ETH
        requestOrderApi(host, "/v1/KCS-ETH/order", "BUY", ZAmount, ZPrice)
            .then(
            //Sell KCS to BTC
            requestOrderApi(host, "/v1/KCS-BTC/order", "SELL", YAmount, YPrice)
            )
            .then(
            //Buy ETH from BTC
            requestOrderApi(host, "/v1/ETH-BTC/order", "BUY", LAmount, LPrice)
            )

    }
});

