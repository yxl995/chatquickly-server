const express = require('express')
const fs = require('fs')
const https = require('https')
const socketIO = require('socket.io')
const app = express()
const httpsOption = {
    //证书配置
    key: fs.readFileSync("***.key"),
    cert: fs.readFileSync("***.pem")
}
const server = https.createServer(httpsOption, app)
const io = socketIO(server, {
    cors: {
        origin: '*'
    }
})
const crypto = require('crypto')
const md5 = content => crypto.createHash('md5').update(content).digest("hex")
const expiredTime = minute => Math.floor(new Date().getTime() / 1000 + minute * 60)
const getToken = (appId, appSign, userID, minute) => {
    let nonce = new Date().getTime().toString()
    let time = expiredTime(minute)
    let appSign32 = appSign.replace(/0x/g, '').replace(/,/g, '').substring(0, 32)
    if (appSign32.length < 32) return null
    let source = md5(appId + appSign32 + userID + nonce + time)
    let jsonStr = JSON.stringify({
        'ver': 1,
        'expired': time,
        'nonce': nonce,
        'hash': source
    })
    return Buffer.from(jsonStr).toString('base64')
}

let userList = {}

io.on('connection', socket => {
    socket.on('login', data => {
        let flag = false
        for (let key in userList)
            if (key === data) {
                flag = true
                break
            }
        socket.emit('usernameRepeat', flag)
        if (!flag) {
            userList[data] = {id: socket.id}
            io.emit('userEnter', {username: data, id: socket.id})
        }
    })

    socket.on('getUserList', () => {
        socket.emit('getUserList', userList)
    })

    socket.on('sendMsg', data => {
        io.to(data.to).emit("sendMsg", data)
    })

    socket.on('call', data => {
        io.to(userList[data.to].id).emit('call', {from: data.from, streamID: data.streamID, type: data.type})
    })

    socket.on('responsePhone', data => {
        io.to(userList[data.to].id).emit('responsePhone', {flag: data.connect, streamID: data.streamID})
    })

    socket.on('dialOut', data => {
        io.to(userList[data].id).emit('dialOut')
    })

    socket.on("disconnect", () => {
        for (let key in userList) {
            if (userList[key].id === socket.id) {
                io.emit('userQuit', key)
                delete userList[key]
                break
            }
        }
    })
})

app.all('*', function (request, response, next) {
    if (!request.get('Origin')) return next();
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'GET');
    response.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    if ('OPTIONS' === request.method) return response.send(200);
    next();
})

app.get('/api/token', (request, response) => {
    const {appId, appSign, minute, userID} = request.query
    response.json({
        code: 200,
        message: 'success',
        data: getToken(appId, appSign, userID, minute)
    })
})

server.listen(8090)