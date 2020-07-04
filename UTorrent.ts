import util from 'util'

import omit from 'lodash/omit'

import { request_page, request_json, get_ip_info } from 'MyNet'
import { fread_lines, fwrite } from 'MyFile'
import { delay, log_line } from 'MyUtils'
import { psh } from 'MyProcess'
import { isIPv6 } from 'net'


class Peer {
    country: string
    ip: string
    reverse_dns: string
    utp: number
    port: number
    client: string
    flags: string
    /** 0 - 1000 */
    progress: number
    download_speed: number
    upload_speed: number
    requests_out: number
    requests_in: number
    waited: Date
    uploaded: number
    downloaded: number
    hash_error: number
    /** 用户 */
    peer_download_speed: number
    max_upload_speed: number
    max_download_speed: number
    queued: number
    inactive: number
    relevance: number
    
    torrent: Torrent
    
    should_block: boolean
    
    
    constructor (raw_data: (string | number)[], torrent: Torrent) {
        this.torrent = torrent
        
        let [
            country,
            ip,
            reverse_dns,
            utp,
            port,
            client,
            flags,
            progress,
            download_speed,
            upload_speed,
            requests_out,
            requests_in,
            waited,
            uploaded,
            downloaded,
            hash_error,
            peer_download_speed,
            max_upload_speed,
            max_download_speed,
            queued,
            inactive,
            relevance
        ]: any[] = raw_data
        
        waited = new Date(waited * 1000)
        
        Object.assign(this, {
            country,
            ip,
            reverse_dns,
            utp,
            port,
            client,
            flags,
            progress,
            download_speed,
            upload_speed,
            requests_out,
            requests_in,
            waited,
            uploaded,
            downloaded,
            hash_error,
            peer_download_speed,
            max_upload_speed,
            max_download_speed,
            queued,
            inactive,
            relevance
        })
        
        
        this.should_block = this.torrent.state[0] === '做种' ?
            /-XL0012-|Xunlei|^7\.|aria2|Xfplay|dandanplay|FDM|go\.torrent|Mozilla/i.test(this.client) && this.upload_speed > 10 * 2 ** 10
        : this.torrent.state[0] === '下载' ?
            /-XL0012-|Xunlei|^7\.|aria2|Xfplay|dandanplay|FDM|go\.torrent|Mozilla/i.test(this.client) && this.uploaded > this.downloaded * 10 + 5 * 2**20
        :
            false
    }
    
    
    to_str () {
        return '' +
            /* 名称         */      this.flags.pad(8) + ' ' +
            /* Client UA    */      this.format_client() + ' ' +
            /* IP:PORT IP 信息 */   this.format_ipinfo() +
            /* 下载速度     */      this.format_download_speed()    + ' ／  '  + /* 上传速度 */ this.format_upload_speed() + '  |  ' + 
            /* 累计下载     */      this.format_downloaded()        + ' ／  '  + /* 累计上传 */ this.uploaded.to_fsize_str().pad(12) + ' ' +
            /* 种子名称     */      this.torrent.name.limit(90)
    }
    
    
    format_client () {
        if (this.client.includes('-XL0012-'))
            return ( this.client.slice(0, '-XL0012-'.length) + ' ***' ).limit(30)
        
        return this.client.limit(30)
    }
    
    format_download_speed () {
        const s = ( this.torrent.state[0] === '做种'  ?  ''  :  this.download_speed.to_fsize_str() + '/s' ).pad(12)
        return ( this.download_speed > 50 * 2 ** 10  ?  s.magenta  :  s )
    }
    
    format_upload_speed () {
        const s = (this.upload_speed.to_fsize_str() + '/s').pad(12)
        return this.upload_speed > 200 * 2 ** 10 ? s.green : s
    }
    
    format_downloaded () {
        return ( this.torrent.state[0] === '做种'  ?   ''  :  this.downloaded.to_fsize_str() ).pad(10)
    }
    
    format_ipinfo () {
        const ip_width   = 24
        const info_width = 50
        
        return isIPv6(this.ip) ?
                ( this.ip.bracket('SQUARE') + ':' + this.port ).pad(ip_width + info_width)
            :
                ( this.ip + ':' + this.port ).pad(ip_width) + get_ip_info(this.ip).limit(info_width)
    }
    
    [util.inspect.custom] () {
        const _this = {
            ...this, 
            should_block: this.should_block,
            progress: this.progress / 10 + '%',
            uploaded: this.uploaded.to_fsize_str(),
            downloaded: this.downloaded.to_fsize_str(),
            upload_speed: this.upload_speed.to_fsize_str() + '/s',
            download_speed: this.download_speed.to_fsize_str() + '/s',
            peer_download_speed: this.peer_download_speed.to_fsize_str() + '/s',
            max_upload_speed: this.max_upload_speed.to_fsize_str() + '/s',
            max_download_speed: this.max_download_speed.to_fsize_str() + '/s',
            waited: this.waited.to_str(),
        }
        
        const omit_keys = [ 'torrent', ... this.utp === 0 ? ['utp'] : [ ], 'relevance' ]
        
        return this.torrent.state[0] === '做种' ? 
            omit(_this, omit_keys, [ 'download_speed' ])
        :
            omit(_this, omit_keys)
    }
}


enum Status {
    STARTED  = 1 << 0, 
    CHECKING = 1 << 1, 
    ERROR    = 1 << 4, 
    PAUSED   = 1 << 5, 
    QUEUED   = 1 << 6, 
}


class Torrent {
    hash: string
    
    status: number
    
    name: string
    
    /** bytes */
    size: number
    
    /** 0 - 1000 */
    progress: number
    
    
    /** uTorrent 累计下载量 bytes */
    downloaded: number
    
    /** uTorrent 累积上传量 bytes */
    uploaded: number
    
    
    /** 需除以 1000 ? */
    ratio: number
    
    /** bytes/second */
    upload_speed: number
    
    /** bytes/second */
    download_speed: number
    
    /** estimated time of arrival (seconds) */
    time_remaining: number
    
    label: string
    
    peers_connected: number
    
    peers_in_swarm: number
    
    seeds_connected: number
    
    seeds_in_swarm: number
    
    availability: number
    
    /** -1 表示未在队列中 */
    queue_position: number
    
    /** 剩余大小 */
    remaining: number
    
    download_url: string
    
    rss_feed_url: string
    
    status_message: string
    
    stream_id: string
    
    date_added: Date
    
    date_completed: Date
    
    app_update_url: string
    
    save_path: string
    
    
    
    /** status 按位与 Status 相与并结合 progress 信息得到 */
    state: [ '下载' | '做种' | '暂停' | '停止' | '完成' | '检查' | '错误' | '排队', string ]
    
    utorrent: UTorrent
    
    peers: Peer[]
    
    
    constructor (raw_data: (string | number)[], utorrent: UTorrent) {
        this.utorrent = utorrent
        
        let [
            hash,
            status,
            name,
            size,
            progress,
            downloaded,
            uploaded,
            ratio,
            upload_speed,
            download_speed,
            time_remaining,
            label,
            peers_connected,
            peers_in_swarm,
            seeds_connected,
            seeds_in_swarm,
            availability,
            queue_position,
            remaining,
            download_url,
            rss_feed_url,
            status_message,
            stream_id,
            date_added,
            date_completed,
            app_update_url,
            save_path
        ]: any[] = raw_data
        
        
        this.state = status & Status.PAUSED ? 
            [ '暂停',  status & Status.CHECKING ? `已检查 ${ progress / 10 }` : '下载' ]
        : status & Status.STARTED ? 
            [ progress === 1000 ? '做种' : '下载',  status & Status.QUEUED ? '' : '强制' ]
        : status & Status.CHECKING ?
            [ '检查', `已检查 ${ progress / 10 }` ]
        : status & Status.ERROR ?
            [ '错误', status_message ]
        : status & Status.QUEUED ?
            [ '排队', progress === 1000 ? '做种' : '下载' ]
        : progress === 1000 ?
            [ '完成', '' ]
        :
            [ '停止', '' ]
        
        
        
        date_added = new Date(date_added * 1000)
        
        date_completed = new Date(date_completed * 1000)
        
        save_path = (save_path as string).to_slash()
        
        Object.assign(this, {
            hash,
            status,
            name,
            size,
            progress,
            downloaded,
            uploaded,
            ratio,
            upload_speed,
            download_speed,
            time_remaining,
            label,
            peers_connected,
            peers_in_swarm,
            seeds_connected,
            seeds_in_swarm,
            availability,
            queue_position,
            remaining,
            download_url,
            rss_feed_url,
            status_message,
            stream_id,
            date_added,
            date_completed,
            app_update_url,
            save_path
        })
    }
    
    
    async get_peers (): Promise<Peer[]> {
        const result = await this.utorrent.rpc({
            params: {
                action: 'getpeers',
                hash: this.hash
            }
        })
        return this.peers = result.peers[1].map( peer => new Peer(peer, this))
    }
    
    
    [util.inspect.custom] () {
        const _this = {
            ...this,
            ... this.peers ? { peers: this.peers.length } : { },
            size: this.size.to_fsize_str(),
            progress: this.progress / 10 + '%',
            remaining: this.remaining.to_fsize_str(),
            downloaded: this.downloaded.to_fsize_str(),
            uploaded: this.uploaded.to_fsize_str(),
            upload_speed: this.upload_speed.to_fsize_str() + '/s',
            download_speed: this.download_speed.to_fsize_str() + '/s',
            time_remaining: Math.ceil(this.time_remaining / 60) + ' min',
            date_added: this.date_added.to_str(),
            date_completed: this.date_completed.to_str(),
            save_path: this.save_path,
        }
        
        
        
        const omit_keys = [ 'utorrent', 'status', 'ratio', 'label', 'availability', 'queue_position', 'download_url', 'rss_feed_url', 'stream_id', 'app_update_url' ]
        
        return this.state[0] === '做种' ?
            omit(_this, omit_keys, [ 'progress', 'downloaded', 'download_speed', 'time_remaining', 'seeds_connected', 'remaining', 'status_message' ])
        : this.state[0] === '下载' ?
            omit(_this, omit_keys)
        :
            omit(_this, omit_keys, [ 'peers', 'upload_speed', 'download_speed', 'time_remaining', 'peers_connected', 'peers_in_swarm', 'seeds_connected', 'seeds_in_swarm' ])
    }
    
    
    to_str () {
        return '' +
            /* 种子名称 */      this.name.limit(100)    + ' ' +
            /* 状态     */      this.format_state()     + ' ' +
            /* 进度     */      (this.state[0] !== '做种' ? (this.progress / 10 + '%') : '').pad(6) + '   ' +
            /* 下载速度 */      this.format_download_speed()  + ' ／  ' + /* 上传速度 */      this.format_upload_speed() + '    |    ' +
            /* 累计上传大小 */  this.uploaded.to_fsize_str().pad(8) + '    ' +
            /* 已连接种子数 (总种子数) */ ( this.seeds_connected.toString().pad(3) + '(' + this.seeds_in_swarm + ')' ).pad(7) + '／ ' + 
            /* 已连接用户数 (总用户数) */ ( this.peers_connected.toString().pad(3) + '(' + this.peers_in_swarm + ')' ).pad(8) + '    ' + 
            /* 剩余时间 */      this.format_time_remaining()
    }
    
    
    format_upload_speed () {
        const s = `${ this.upload_speed.to_fsize_str()}/s`.pad(12)
        return this.upload_speed > 500 * 2**10  ?  s.green  :  s
    }
    
    
    format_download_speed () {
        const width = 12
        if (this.state[0] !== '下载') return ''.pad(width)
        const s = `${ this.download_speed.to_fsize_str() }/s`.pad(width)
        return ( this.download_speed > 100 * 2**10 ?  s.magenta  :  s.yellow )
    }
    
    
    format_state () {
        const s = ( this.state[0] + ( this.state[1] ? ` (${ this.state[1] })` : '' ) ).pad(10)
        return this.state[0] === '下载' ? s.yellow : s
    }
    
    
    format_time_remaining () {
        if (this.state[0] !== '下载') return ''
        const hours   = Math.floor( this.time_remaining / 3600 )
        const minutes = Math.ceil( this.time_remaining / 60)
        if (hours === -1) return '-'
        if (hours)      return ( hours + ' 小时' ).yellow
        if (minutes)    return ( minutes + ' 分钟' ).yellow
        return ''
    }
}


export class UTorrent {
    root_url: string
    username: string
    password: string
    ipfilter_dat: string
    
    /** 检测 peers 并屏蔽的时间间隔 */
    interval: number
    
    state: 'IDLE' | 'RUNNING' = 'IDLE'
    
    print: {
        /** ['下载'] */
        torrents: '下载' | '做种' | '所有' | boolean
        
        /** [true] */
        peers: boolean
    } = {
        torrents: '所有',
        peers: true
    }
    
    
    token: string
    
    torrents: Torrent[]
    
    blocked_ips: Set<string>
    
    static async start () {
        await psh('C:/Users/shf/AppData/Roaming/uTorrent/uTorrent.exe')
    }
    
    
    private constructor (data: Partial<UTorrent>) {
        Object.assign(this, data)
    }
    
    
    static async connect (
        options: {
            root_url: string
            username: string
            password: string
            ipfilter_dat: string
            interval: number
            
            /** print?: true */
            print?: boolean | {
                /** ['下载'] */
                torrents: '下载' | '做种' | '所有' | boolean
                
                /** [true] */
                peers: boolean
            }
        }
    ) {
        
        let utorrent = new UTorrent({
                ...options, 
                blocked_ips: new Set((await fread_lines(options.ipfilter_dat)).trim_lines()),
                print: (() => {
                    if (!('print' in options)) return { torrents: true, peers: true }
                    if (typeof options.print === 'boolean') return { torrents: options.print, peers: options.print }
                    return options.print
                })()
            }
        )
        
        await utorrent.get_token()
        
        return utorrent
    }
    
    
    /** get token */
    async get_token () {
        const $ = await request_page(this.root_url + 'token.html', {
            auth: {
                username: this.username,
                password: this.password
            }
        })
        
        this.token = $('#token').text()
    }
    
    
    async rpc ({ api = '', params, method = 'GET' }: {api?: string, params?: Record<string, any>, method?: 'GET' | 'POST'} = { }) {
        return await request_json(this.root_url + api, {
            method,
            queries: {
                token: this.token,
                ...params
            },
            auth: {
                username: this.username,
                password: this.password
            }
        })
    }
    
    
    async get_torrents (): Promise<Torrent[]> {
        return this.torrents = (await this.rpc({ params: { list: 1 } })).torrents.map( (t: (string | number)[]) => new Torrent(t, this))
    }
    
    
    async get_peers (torrents?: Torrent[]): Promise<Peer[]> {
        if (!torrents)
            torrents = await this.get_torrents()
        return (await Promise.all(
            torrents
                .filter( torrent => torrent.state[0] === '下载' || torrent.state[0] === '做种')
                .map( async torrent => await torrent.get_peers()))
        ).flat()
    }
    
    
    async print_peers (peers?: Peer[], { limit }: { limit?: number } = { }) {
        if (!peers)
            peers = await this.get_peers()
        
        peers
            .sort( (a, b) => - (
                ((a.should_block ? 1 : 0) * 2**30 + a.download_speed * 10 + a.upload_speed) - 
                ((b.should_block ? 1 : 0) * 2**30 + b.download_speed * 10 + b.upload_speed)
            ))
            .filter( (peer, i) => peer.should_block || (peer.upload_speed + peer.download_speed) > 5 * 2**10 && (limit ? i < limit : true) )
            .forEach( peer => {
                const s = peer.to_str()
                console.log( peer.should_block ? s.red : s)
            })
    }
    
    
    async print_torrents ({
        torrents, 
        filter = torrent => torrent.state[0] === '下载' || (torrent.state[0] === '做种' ? torrent.upload_speed > 10 * 2**10 : false)
    }: {
        torrents?: Torrent[]
        filter?: (torrent: Torrent) => boolean
    } = { }) {
        if (!torrents)
            torrents = await this.get_torrents()
        
        torrents
            .filter(filter)
            .filter( torrent => this.print.torrents && ( this.print.torrents === '所有' || this.print.torrents === torrent.state[0]))
            .sort( (a, b) => - (
                ((a.state[0] === '下载' ? 1 : 0) * 2**30 + a.download_speed * 10 + a.upload_speed) -
                ((b.state[0] === '下载' ? 1 : 0) * 2**30 + b.download_speed * 10 + b.upload_speed)
            ))
            .forEach( torrent => {
                console.log(torrent.to_str())
            })
    }
    
    
    async print_blockeds () {
        this.blocked_ips.forEach( ip => {
            console.log(ip.pad(20) + get_ip_info(ip))
        })
    }
    
    async block_peers (torrents?: Torrent[]) {
        if (!torrents)
            torrents = await this.get_torrents()
        const peers = await this.get_peers(torrents.filter( torrent => torrent.download_speed + torrent.upload_speed > 20 * 2**10))
        const peers2block = peers.filter( peer => peer.should_block)
        
        if (this.print.peers)
            await this.print_peers(peers, { limit: 50 })
        
        if (!peers2block.length) return
        
        peers2block.forEach( peer => {
            this.blocked_ips.add(peer.ip)
        })
        
        await fwrite(this.ipfilter_dat, [...this.blocked_ips].join_lines() + '\n', { print: Boolean(this.print.peers || this.print.torrents) })
        
        await this.reload_ipfilter()
        
        return peers2block
    }
    
    
    async reload_ipfilter () {
        return await this.rpc({
            params: {
                action: 'setsetting',
                s: 'ipfilter.enable',
                v: '1'
            }
        })
    }
    
    
    async reset_ipfilter () {
        this.blocked_ips = new Set()
        await fwrite(this.ipfilter_dat, '')
        await this.reload_ipfilter()
    }
    
    
    find_torrent (name_pattern: string | RegExp) {
        if (typeof name_pattern === 'string')
            name_pattern = new RegExp(name_pattern, 'i')
        return this.torrents.find(torrent => (name_pattern as RegExp).test(torrent.name))
    }
    
    
    async start_blocking () {
        await this.get_token()
        this.state = 'RUNNING'
        while (this.state === 'RUNNING') {
            if (this.print.torrents || this.print.peers)
                console.log('\n\n\n' + new Date().to_str())
            
            try {
                if (this.print.torrents) {
                    await this.print_torrents()
                    log_line(200)
                    await this.block_peers(this.torrents)
                } else
                    await this.block_peers()
                
                await delay(this.interval)
            } catch (error) {
                this.state = 'IDLE'
                throw error
            }
        }
        console.log('uTorrent blocking stopped')
    }
    
    
    stop_blocking () {
        this.state = 'IDLE'
    }
    
    
    hide_display () {
        this.print = {
            torrents: false,
            peers: false
        }
    }
    
    show_display () {
        this.print = {
            torrents: '所有',
            peers: true
        }
    }
    
}

export default UTorrent


// ------------------------------------ uTorrent
async function repl_utorrent () {
    UTorrent.start()
    
    let utorrent = await UTorrent.connect({
        root_url: 'http://127.0.0.1:1000/gui/',
        username: 'xxx',
        password: 'xxxxxxxx',
        ipfilter_dat: 'C:/Users/xxx/AppData/Roaming/uTorrent/ipfilter.dat',
        interval: 20 * 1000,
        print: {
            torrents: '所有',
            peers: true
        }
    })
    
    utorrent.start_blocking()
    
    utorrent.hide_display()
    
    utorrent.show_display()
    
    utorrent.stop_blocking()
    
    utorrent.reset_ipfilter()
    
    utorrent.block_peers()
    
    utorrent.print_blockeds()
    
    
    utorrent.state
}


