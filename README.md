# uTorrent 自动屏蔽迅雷脚本
## 功能

每隔 30 秒，自动检查 uTorrent 已连接的用户列表，找出迅雷客户端，强制断开，不给吸血雷上传任何数据，并将用户 IP 加入黑名单阻止其再次连接，把带宽留给正规 BT 客户端。

## 屏蔽列表

-XL0012-***

Xunlei/***

7.x.x.x

Xfplay

## 实现方法

1.  根据 uTorrent 的 WebUI API 发送 http request 获取所有已连接用户(peers)信息
2.  按照 client name 筛选出使用迅雷的 peer IP，写入 ipfilter.dat 文件
3.  发送 http request 让 uTorrent 重新加载 ipfilter.dat
4.  uTorrent 禁止 ipfilter.dat 中的 IP 连接

## 脚本

```coffeescript
cheerio = require 'cheerio'
request = require 'request-promise-native'
Sugar   = require('sugar').extend()

log = console.log.bind console

# 自行修改脚本中 root_url, auth, ipfilter_path 相关内容
# 检查间隔时间可在脚本中自定义，IP黑名单(ipfilter.dat) 建议每天清空一次。

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
        await @get_torrents()
        peers = await @get_all_peers()
        blocks = peers.filter (x)-> x.client.match /(-XL0012-)|(Xunlei)|(^7\.)|(Xfplay)/i
        if blocks.isEmpty()
            log 'no xunlei clients detected, current peers:'
            log peers
            return
        log 'block', blocks
        
        ipfilter_path = 'C:/Users/shf/AppData/Roaming/uTorrent/ipfilter.dat'
        fs.writeFileSync(ipfilter_path, fs.readFileSync(ipfilter_path, 'UTF8').trim().split('\n').append(x.ip for x in blocks).unique().join('\n') + '\n')
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
        , 30*1000
        
    stop: ->
        clearInterval @task

main= ->
    await utorrent.init()
    await utorrent.run()

main()
```

## 依赖

>uTorrent Pro 3.5.4 (build 44846) [32-bit] & uTorrent WebUI v0.388
>
>​    启用 uTorrent 网页界面
>
>​    在 uTorrent 目录下保证 ipfilter.dat 文件存在（若不存在则新建空白 ipfilter.dat 文件），脚本会在原有 ipfilter.dat 文件内容之后添加被屏蔽的迅雷 IP，不影响已有内容及其功能。 
>
>​    高级选项
>
>​        ipfilter.enable: true
>
>​        bt.use_rangeblock: false
>
>Node.js
>
>CoffeeScript
>
>NPM Packages
>
>​    Sugar.js
>
>​    request-promise-native
>
>​    cheerio

## 日志

未检测到迅雷时

```
当前已连接用户
[ { ip: '180.94.154.163', client: 'µTorrent/3.5.4.0' },
  { ip: '223.140.248.38', client: 'BitComet 1.53' },
  { ip: '101.88.108.19', client: 'µTorrent/2.2.1.0' },
  { ip: '39.161.242.50', client: 'Unknown FD/5.1.0.0' },
  { ip: '171.88.70.72', client: 'Transmission 2.94' },
  { ip: '218.79.69.196', client: '[FAKE] µTorrent/3.0.0.0' },
  { ip: '123.204.251.13', client: 'BitComet 1.51' },
  { ip: '154.103.221.22', client: 'qBittorrent 4.1.3' },
  { ip: '118.150.188.121', client: 'μTorrent 3.5.3' }]
```

检测到迅雷时

```
使用迅雷的用户
[ { ip: '183.25.54.216', client: '-XL0012-溶S鑋亾#+4厓' },
{ ip: '223.81.192.235', client: '-XL0012-輓%??1涙鷉' },
{ ip: '223.72.70.198', client: '7.10.35.366' }]
reading C:/Users/shf/AppData/Roaming/uTorrent/ipfilter.dat
wrote C:/Users/shf/AppData/Roaming/uTorrent/ipfilter.dat
ipfilter.dat updated
ipfilter.dat reloaded
```

#### uTorrent Log

勾选 记录用户通讯信息 > 记录用户拦截连接

```
[2018-11-22 19:03:43]  Loaded ipfilter.dat (51 entries)
[2018-11-22 19:03:46]  IpFilter blocked peer 223.81.192.235
[2018-11-22 19:03:49]  IpFilter blocked peer 223.81.192.235
[2018-11-22 19:04:06]  IpFilter blocked peer 223.81.192.235
[2018-11-22 19:04:21]  IpFilter blocked peer 183.25.54.216
[2018-11-22 19:04:46]  IpFilter blocked peer 223.81.192.235
...
```



