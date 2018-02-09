const request = require('request')
const crypto = require('crypto')
const apiKey = require('./.apikey.json')
const log = console.log

var host = "https://api.kucoin.com"
var userEndpoint = "/v1/user/info"

const targetPair = [
    { coin: "ETC", amount: 0.12 },
    { coin: "NEO", amount: 2 },
    { coin: "KCS", amount: 0.1 },
]

const fee = 0.001 //0.1%
const remainFee = 1 - fee
const futureFee = 1 + fee

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
///////////////////////////////////////////
/**
 * PROCESSING
 */
function processing(pairZ, pairY, pairL, inputAmount) {
    return new Promise(function (resolve, reject) {
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

            log(`${ZPrice} ${YPrice} ${LPrice} : ${ZAmount} ${YAmount} ${LAmount} => check: ${check}`)
            var left = YPrice
            var right = (ZPrice * LPrice).toFixed(8)
            var change = ((left / right - 1) * 100).toFixed(2)
            var condition = (left > right) && check
            log(`Condition 'Y > Z x L' is ${condition} [Left: ${left}; Right: ${right}]; Change: ${change}%`)
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
                    .then(resolve())
            } else {
                resolve()
            }

        })
    })
}

var i = 0
function main() {
    var pairL = "ETH-BTC"
    if (i == targetPair.length) {
        setTimeout(() => {
            i = 0
            main()
        }, 2000)
        return
    }
    log(i)
    var targetCoin = targetPair[i].coin
    var inputAmount = targetPair[i].amount

    var pairZ = `${targetCoin}-ETH`
    var pairY = `${targetCoin}-BTC`
    processing(pairZ, pairY, pairL, inputAmount)
        .then(() => {
            setTimeout(() => {
                main()
            }, 1000)
        })
    i++
}

//EXECUTE MAIN
main()