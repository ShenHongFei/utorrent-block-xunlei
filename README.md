# uTorrent 屏蔽迅雷方法(反吸血)

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
                user: 'admin'
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
                user: 'admin'
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
        for peer in peers
            ip: peer[1]
            client: peer[5]
        
    block_xunlei: ->
        peers = await @get_all_peers()
        blocks = peers.filter (x)-> x.client.match /(-XL0012-)|(Xunlei)|(^7\.)|(Xfplay)/i
        if blocks.isEmpty()
            log 'no xunlei clients detected'
            log peers
            return
        else
            log blocks
        ipfilter = new File 'C:/Users/xxx/AppData/Roaming/uTorrent/ipfilter.dat'
        ipfilter.data += (x.ip for x in blocks).join('\n') + '\n'
        ipfilter.save()
        log 'ipfilter.dat updated'
        await utorrent.call params:
            action: 'setsetting'
            s: 'ipfilter.enable'
            v: '1'
        log 'ipfilter.dat reloaded'
        
    run: ->
        await utorrent.init()
        await utorrent.block_xunlei()
        @task = setInterval -> 
            await utorrent.block_xunlei()
        , 3*60*1000
        
    stop: ->
        @task.clearInterval()

```

