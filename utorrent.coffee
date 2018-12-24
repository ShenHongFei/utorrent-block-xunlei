fs      = require 'fs'

cheerio = require 'cheerio'
request = require 'request-promise-native'
Sugar   = require('sugar').extend()


log = console.log.bind console

# 自行修改脚本中 root_url, auth, ipfilter_path 相关内容
# 检查间隔时间可在脚本中自定义，IP黑名单(ipfilter.dat) 建议每天清空一次。

utorrent=
    root_url: 'http://127.0.0.1:1000/gui/'
    auth:
        user: 'xxx'
        pass: 'xxxxxx'
    ipfilter_path: 'C:/Users/xxx/AppData/Roaming/uTorrent/ipfilter.dat'
    
    blocked_ips: []
    logging: true
    
    init: ->
        @cookies= request.jar()
        token_html = await request
            uri: @root_url + 'token.html'
            auth: @auth
            jar: @cookies
        $ = cheerio.load token_html
        @token = $('div').text()
        @blocked_ips = fs.readFileSync(@ipfilter_path, 'UTF-8').split('\n').unique()
        log '开始运行'
        await @get_torrents()
        
    call: ({api='', params, method='GET'}={})->
        JSON.parse await request
            uri: @root_url + api
            method: method
            qs:{
                token: @token
                params...
            }
            auth: @auth
            jar: @cookies
    
    get_torrents: -> 
        result = await @call params: list: 1
        @torrents = result.torrents
        @hashes = @torrents.map (x)-> x[0]
    
    get_peers: (hash)->
        resp = await @call params:
            action: 'getpeers'
            hash: hash
        for peer in resp.peers[1]
            ip             : peer[1]
            hostname       : peer[2]
            country        : peer[0]
            port           : peer[4]
            client         : peer[5]
            flags          : peer[6]
            downloaded     : peer[13]
            uploaded       : peer[14]
            uploading_speed: peer[16]
    
    get_all_peers: ->
        peers = []
        for hash in @hashes
            peers.append await @get_peers hash
        peers.unique('ip').sortBy 'client'
        
    block: ->
        await @get_torrents()
        peers = await @get_all_peers()
        peers2block = peers.filter (peer)->
            peer.client.match(/(-XL0012-)|(Xunlei)|(^7\.)|(QQDownload)/i) ||
            peer.downloaded > 2 * peer.uploaded &&
            peer.client.match ///
                (Xfplay)|
                (dandanplay)|
                (FDM)|
                (go\.torrent)|
                (Mozilla\/)
                ///i
            
        if peers2block.isEmpty() then return
        if @logging then log '屏蔽', peers2block.map ['ip', 'client']
        
        @blocked_ips = @blocked_ips.append(peers2block.map('ip')).unique()
        fs.writeFileSync(@ipfilter_path, @blocked_ips.join('\n') + '\n')
        
        await @call params:
            action: 'setsetting'
            s: 'ipfilter.enable'
            v: '1'
        # log '已重载 ipfilter.dat'
        
    set_ip: (ip)->
        await @call params:
            action: 'setsetting'
            s: 'tracker_ip'
            v: ip
    
    unblock: ->
        @blocked_ips = []
        await @call params:
            action: 'setsetting'
            s: 'ipfilter.enable'
            v: '0'
    
    reset_blocking: (immediate=false)->
        @blocked_ips = []
        if !immediate then return
        fs.writeFileSync(@ipfilter_path, @blocked_ips.join('\n') + '\n')
        await @call params:
            action: 'setsetting'
            s: 'ipfilter.enable'
            v: '1'
        
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
