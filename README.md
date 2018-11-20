# uTorrent 自动屏蔽迅雷脚本
## 方法

1.  根据 uTorrent 的 WebUI API 发送 http request 获取到所有种子的 peers 信息
2.  按照 client name 筛选出使用迅雷的 peer IP，写入 ipfilter.dat 文件
3.  发送 http request 让 uTorrent 重新加载 ipfilter.dat

## 屏蔽列表

-XL0012-***

Xunlei/***

7.x.x.x

Xfplay

## 效果

每隔一段时间，已连接用户中使用迅雷客户端的 IP 将会被封锁

## 脚本

```coffeescript
utorrent=
    init: ->
        @root_url= 'http://127.0.0.1:10000/gui/'
        @cookies= request.jar()
        token_html = await request
            uri: @root_url + 'token.html'
            auth:
                user: 'shf'
                pass: 'xxxxxx'
            jar: @cookies
        $ = cheerio.load token_html
        @token = $('div').text()
        await @get_torrents()
        
    call: ({api='', params, method='GET'}={})->
        JSON.parse await request
            uri: @root_url + api
            method: method
            qs:{
                token: @token
                params...
            }
            auth:
                user: 'shf'
                pass: 'xxxxxx'
            jar: @cookies
    
    get_torrents: -> 
        @torrents = (await @call params: list: 1).torrents
        @hashes = @torrents.map (x)-> x[0]
        
    get_peers: (hash)->
        resp = await @call params:
            action: 'getpeers'
            hash: hash
        resp.peers
    
    get_all_peers: ->
        peers = []
        for hash in @hashes
            peers.append((await @get_peers hash)[1])
        peers = for peer in peers
            ip: peer[1]
            client: peer[5]
        peers.unique().sortBy 'client'
        
    block: ->
        peers = await @get_all_peers()
        blocks = peers.filter (x)-> x.client.match /(-XL0012-)|(Xunlei)|(^7\.)|(Xfplay)/i
        if blocks.isEmpty() then return
        log 'block', blocks
        
        ipfilter = new File 'C:/Users/shf/AppData/Roaming/uTorrent/ipfilter.dat'
        ipfilter.save data: ipfilter.data.trim().split('\n').append(x.ip for x in blocks).unique().sortBy((x)-> x.split '.').join('\n') + '\n'
        # log 'ipfilter.dat updated'
        
        await @call params:
            action: 'setsetting'
            s: 'ipfilter.enable'
            v: '1'
        # log 'ipfilter.dat reloaded'
        
    unblock: ->
        await @call params:
            action: 'setsetting'
            s: 'ipfilter.enable'
            v: '0'
    
    run: ->
        await @block()
        @task = setInterval => 
            await @block()
        , 3*60*1000
        
    stop: ->
        clearInterval @task

```

## 依赖

Node.js

uTorrent WebUI 启用

CoffeeScript

NPM Packages

​    Sugar.js

​    request-promise-native

​    cheerio

## 日志

未检测到迅雷时

```
no xunlei clients detected
当前已连接 peers
[ { ip: '180.94.154.163', client: 'µTorrent/3.5.4.0' },
  { ip: '223.140.248.38', client: 'BitComet 1.53' },
  { ip: '101.88.108.19', client: 'µTorrent/2.2.1.0' },
  { ip: '39.161.242.50', client: 'Unknown FD/5.1.0.0' },
  { ip: '171.88.70.72', client: 'Transmission 2.94' },
  { ip: '218.79.69.196', client: '[FAKE] µTorrent/3.0.0.0' },
  { ip: '123.204.251.13', client: 'BitComet 1.51' },
  { ip: '118.150.188.121', client: 'μTorrent 3.5.3' },
  { ip: '118.150.188.121', client: 'μTorrent 3.5.3' },
  { ip: '118.150.188.121', client: 'μTorrent 3.5.3' } ]
[ { ip: '222.164.100.163', client: '7.9.34.4908' } ]
```

检测到迅雷时

```
使用迅雷的 peers
[ { ip: '183.25.54.216', client: '-XL0012-溶S鑋亾#+4厓' } ]
reading C:/Users/shf/AppData/Roaming/uTorrent/ipfilter.dat
wrote C:/Users/shf/AppData/Roaming/uTorrent/ipfilter.dat
ipfilter.dat updated
ipfilter.dat reloaded
```

#### uTorrent Log

[2018-11-19 16:50:25]  Loaded ipfilter.dat (51 entries)

