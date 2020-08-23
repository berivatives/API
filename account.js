//JSON FORMAT - SATOSHI UNIT

//npm install ws
const WebSocket = require('ws'),
    crypto = require('crypto'),
    key = '',
    secret = '',
    satoshi = 100000000,
    account = {}, //map to store some data such as free, locked, positions...
    fails = {}; //to handle the failures

var ws, time, message;

time = String(Date.now());
message = crypto.createHmac('sha512', secret).update(time).digest('hex');
ws = new WebSocket('wss://www.berivatives.com/api?key=' + key + '&message=' + message + '&time=' + time);

ws.on('open', function open() {
    console.log('open');
});

ws.on('message', function incoming(data) {
    const json = JSON.parse(data);

    if (json['my_id'] != undefined) {
        if (json['error'] == true) {
            fails[json['my_id']](); //try to do the operation again
        } else {
            delete my_ids[json['my_id']];
        }
    }

    if (json['error'] == true) {
        console.log(json['message']);
        return;
    }

    //dont use else if because you can have different fields at the same time

    if (json['free'] !== undefined) {
        account['free'] = json['free'];
        getLiquidationPrices(); // liquidation prices can be updated if you add equity to the margin wallet (transfer or bitcoin deposit)
    }

    if (json['locked'] !== undefined) {
        account['locked'] = json['locked'];
    }

    if (json['freefunding'] !== undefined) {
        account['freefunding'] = json['freefunding'];
    }

    if (json['lockedfunding'] !== undefined) {
        account['lockedfunding'] = json['lockedfunding'];
    }

    if (json['op'] !== undefined) { // positions messages
        if (json['t'] == 's') { // snapshot - map of your current positions
            json['op'] = {
                'ETH':
                    {
                        p: 2000000, //entry price in SATOSHI
                        pnl: 1000000, //realized pnl in SATOSHI
                        q: -100000000 //if q < 0 -> SHORT else LONG in SATOSHI
                    },
                'BTC': //only when borrow
                    {
                        p: 5000000, //daily rate = 5000000 -> 5000000 / satoshi = 0.05 = 5%
                        pnl: -1000000, //interests
                        q: 10000000 //0.1BTC Borrowed
                    }
            }
            account['op'] = json['op'];
        } else {
            //It is a single object organized like previously
            if (json['op'] == null) delete account['op'][json['s']]; // null means the position is closed
            else account['op'][json['s']] = json['op']; // new or updated position
        }

        getLiquidationPrices();
    }

    if (json['o'] !== undefined) { //event when an order is placed, filled or canceled
        json['o'] = {
            id: 'id',
            s: 'symbol',
            a: "'b'(buy / borrow) | 's'(sell / lend)",
            t: 'GTC' | 'MKT' | 'STOP' | 'IOC' | 'FOK',
            q: 'quantity',
            p: 'price',
            st: "'O'(opened) | 'F'(filled) | 'C'(canceled) | 'K'(killed) | 'SF'(stop failed) | 'L'(cancel liquidation) | 'CM'(not enough funds to borrow)",
            f: 'quantity filled',
            fe: 'fees',
            t: 'timestamp in milli',
            h: 'hidden',
            r: 'reduce_only',
            po: 'post_only'
        }
    }

    if (json['oo'] !== undefined) { // list of all open orders
        json['oo'] = [
            {
                id: 'id',
                s: 'symbol',
                a: 'b | s',
                ...
            },
            {
                id: 'id',
                s: 'symbol',
                a: 'b | s',
                ...
            },
        ]
    }

    if (json['co'] !== undefined) { // last closed orders
        json['co'] = [
            {
                id: 'id',
                s: 'symbol',
                a: 'b | s',
                ...
            },
            {
                id: 'id',
                s: 'symbol',
                a: 'b | s',
                ...
            },
        ]
    }

    if (json['b'] !== undefined) { // balance messages for deposits, withdraws, profits, losses
        if (json['t'] === undefined) { // snapshot of the last balance events
            json['b'] = [
                [timestamp, 'Label', 'amount (integer)'],
                [timestamp, 'Label', 'amount (integer)'],
            ]
        } else { // new event
            json['b'] = [timestamp, 'Label', 'amount (integer)']
        }
    }

    if (json['legacy'] !== undefined) { // legacy address

    }

    if (json['bech32'] !== undefined) { // segwit address

    }

});

ws.on('error', function error() {
    console.log('error');
});

ws.on('close', function close() {
    console.log('close');
});

/*
action: 's' for sell - 'b' for buy
execution: optional - default GTC - 'GTC' (Good 'Til Cancelled) or 'MKT' (Market) or 'STOP' (Stop Market) or 'IOC' (Immediate Or Cancel) or 'FOK' (Fill Or Kill)
hidden: optional - true or false
post-only : optional - true or false
reduce: optional - true or false
*/
function openOrder(symbol, quantity, price, execution, action, hidden, post_only, reduce) {
    const my_id = Date.now();
    fails[my_id] = function () {
        openOrder(symbol, quantity, price, execution, action);
    };
    ws.send(JSON.stringify({
        m: 'o',
        my_id: my_id,
        a: action,
        s: symbol,
        q: quantity * satoshi,
        p: price * satoshi,
        e: execution,
        h: hidden,
        po: post_only,
        r: reduce
    }));
}

/*
p: optional - new price or former
q: optional - new quantity or former
e: optional boolean to execute the order @ market price
*/
function replaceOrder(id, newPrice, newQteOrFormer, isMarket) {
    const my_id = Date.now();
    fails[my_id] = function () {
        openOrder(symbol, quantity, price, execution, action);
    };
    ws.send(JSON.stringify({
        m: 'r',
        my_id: my_id,
        id: id,
        p: newPriceOrFormer * satoshi,
        q: newQteOrFormer * satoshi,
        e: isMarket
    }));
}

function cancelOrder(id) {
    const my_id = Date.now();
    fails[my_id] = function () {
        openOrder(symbol, quantity, price, execution, action)
    };
    ws.send(JSON.stringify({
        m: 'c',
        my_id: my_id,
        id: id
    }));
}

//type: optional - address type - default is legacy
function getNewAddress() {
    ws.send(JSON.stringify({
        m: 'a',
        type: 'legacy' | 'bech32'
    }));
}

function withdraw(quantity, address) {
    ws.send(JSON.stringify({
        m: 'w',
        q: quantity * satoshi,
        ad: address
    }));
}

//Stop automatic lending renewal
function stopRenewal() {
    ws.send(JSON.stringify({
        m: 'sr'
    }));
}

//Transfer from a wallet to another one. If from == 'margin' transfer from margin to funding wallet
function transfer(quantity) {
    ws.send(JSON.stringify({
        m: 't',
        from: 'margin' | 'funding',
        q: quantity * satoshi
    }));
}

//send a message to the chat - 200 characters max - limit: 1 message / 50 ms 
function message(message) {
    ws.send(JSON.stringify({
        m: 'm',
        msg: message,
    }));
}

function getLiquidationPrices() {
    if (account['op'] === undefined) return;
    account['exposure'] = 0;
    if (account['op']['BTC'] !== undefined) { // undefined means no Bitcoin borrowed
        for (let s in account['op']) {
            if (s == 'BTC' || account['op'][s] == null || account['op'][s] == undefined) continue;
            account['exposure'] += Math.abs(account['op'][s]['q']) * account['op'][s]['p'] / satoshi;
        }
        account['leverage'] = (account['exposure'] - account['op']['BTC']['pnl']) / (account['free'] + account['locked']);
        if (account['leverage'] < 1) return;
        for (let s in account['op']) {
            if (s == 'BTC' || account['op'][s] == null || account['op'][s] == undefined) continue;
            if (account['op'][s]['q'] > 0) { //long
                account['op'][s]['lp'] = account['op'][s]['p'] * (1 - 1 / account['leverage']);
            } else { // short
                account['op'][s]['lp'] = account['op'][s]['p'] * (1 + 1 / account['leverage']);
            }
        }
    }
}
