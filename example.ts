// @ts-nocheck
async function repl_resume_dat () {
    let resume_data = new ResumeData('C:/Users/shf/AppData/Roaming/uTorrent/resume.dat')
    
    // ------------ 选择要修改的种子
    // 按顺序
    // let torrent     = resume_data.torrents[3]
    
    // 按名称
    let torrent = resume_data.get_torrents('物語.*S2')[0]
    let torrents = resume_data.get_torrents('第2期')
    
    // 最近添加
    // let torrent = resume_data.get_torrent()
    
    // 私有种子
    let torrent_pt = resume_data.get_torrents('物語.*S2')[1]
    
    
    // ------------ 指定存放目录及名称
    // 原种子文件名，视频文件名
    // 〈物語〉シリーズ 第2期（猫物語,傾物語,囮物語,鬼物語,恋物語,花物語）[VCB-S][10bit 1080p BDRip][Fin].torrent
    // [VCB-Studio] Koyomimonogatari [12][Ma10p_1080p][x265_2flac].mkv
    
    // 设置主标题
    const name = '〈物語〉シリーズ S2 (猫物語+傾物語+囮物語+鬼物語+恋物語+花物語) (Fin)'
    
    
    // 注意日文空格
    '　'.charCodeAt(0)
    
    
    // 设置压制信息
    // const info = 'BDRip 816p x265 Ma10p FLAC'
    const info = 'BDRip 1080p x264 Hi10p 2FLAC'
    // const info = 'BDRip 1080p x265 Ma10p 2FLAC'
    // const info = 'FLAC'
    
    // 设置字幕组／来源
    // [诸神字幕组 & VCB-Studio]
    // const origin = '喵萌奶茶屋 & VCB-Studio'
    const origin = 'VCB-Studio'
    
    // 设置存放目录
    const dir  = 'G:/ACGN/〈物語〉シリーズ/'
    
    // 生成 caption
    const caption = name + ' ' + info.bracket('SQUARE') + ' ' + origin.bracket('SQUARE')
    
    // 生成种子路径
    const fp_torrent = dir + caption + '.torrent'
    
    
    // 重命名种子文件
    copy(caption)
    
    
    // 参考原 torrent 中的 files
    const ftorrent    = new TorrentFile(fp_torrent)
    
    const ftorrent_pt = new TorrentFile(fp_torrent.replace('.torrent', '.pt.torrent'))
    
    
    
    // 修改任务标题
    torrent.caption = caption
    
    // 修改种子路径
    torrent.fp_torrent = fp_torrent
    
    // 修改任务文件夹
    torrent.path = dir
    
    // 修改任务标签
    torrent.labels = [ 'ACGN' ]
    // torrent.labels = [ '电影' ]
    
    
    
    // (optional) 修改文件名
    // [ [ 58, 'BDRips/01.mkv' ], [ 59, 'BDRips/01.sc.ass' ], ... ]
    torrent.targets =
        [
            ... ftorrent.get_fps().slice(0, 110).map( (fp, index) => 
                ([ 0 + index, fp.reformat(
                    '[VCB-S]Hanamonogatari[1080p]/{any}',
                    '花物語/{any}',
                )])),
            
            ... ftorrent.get_fps().slice(110, 158).map( (fp, index) => 
                ([ 110 + index, fp.reformat(
                    '[VCB-S]Kabukimonogatari[1080p]/{any}',
                    '傾物語/{any}',
                )])),
            
            ... ftorrent.get_fps().slice(158, 215).map( (fp, index) => 
                ([ 158 + index, fp.reformat(
                    '[VCB-S]Koimonogatari[1080p]/{any}',
                    '恋物語/{any}',
                )])),
            
            ... ftorrent.get_fps().slice(215, 267).map( (fp, index) => 
                ([ 215 + index, fp.reformat(
                    '[VCB-S]Nekomonogatari[1080p]/Nekomonogatari (Kuro)/{any}',
                    '猫物語/黑/{any}',
                )])),
            
            ... ftorrent.get_fps().slice(267, 325).map( (fp, index) => 
                ([ 267 + index, fp.reformat(
                    '[VCB-S]Nekomonogatari[1080p]/Nekomonogatari (Shiro)/{any}',
                    '猫物語/白/{any}',
                )])),
            
            ... ftorrent.get_fps().slice(325, 393).map( (fp, index) => 
                ([ 325 + index, fp.reformat(
                    '[VCB-S]Onimonogatari[1080P]/{any}',
                    '鬼物語/{any}',
                )])),
            
            ... ftorrent.get_fps().slice(393, 442).map( (fp, index) => 
                ([ 393 + index, fp.reformat(
                    '[VCB-S]Otorimonogatari[1080p]/{any}',
                    '囮物語/{any}',
                )])),
            
        ] as [number, string][]
        
    torrent.targets[324] = [324, '猫物語/[VCB-S]Monogatari Serise[Recap_Iv2][Hi10p_1080p][BDRip][x264_flac].mkv']
    
    
    // (optional) 重命名文件 ①
    ftorrent.get_fps().slice(0, 37).forEach( (fp, index) => {
        const fp_ = fp.reformat(
            'TOM AND JERRY EP{episode} {title}.mkv',
            '{episode}   {title}.mkv',
        )
        // console.log(fp_)
        rename(fp, fp_, { dir })
    })
    
    
    // (optional) 重命名文件 ②
    const text = paste()
    text.split_lines().trim_lines().forEach( fp => {
        const fp_ = fp.reformat(
            '{episode}   {title}.mkv',
            '0{episode}   {title}.mkv',
        )
        // console.log(fp_)
        rename(fp, fp_, { dir })
    })
    
    // 应用到 .pt.torrent
    torrent_pt.caption      = torrent.caption + '.pt'
    torrent_pt.fp_torrent   = torrent.fp_torrent.replace('.torrent', '.pt.torrent')
    torrent_pt.path         = torrent.path
    torrent_pt.labels       = torrent.labels
    torrent_pt.targets      = torrent.targets
    
    
    
    // 确认修改后的种子
    torrent
    torrent_pt
    
    resume_data.save()
    
    
    UTorrent.start()
}




/** 批量修改多个任务 */
function rename_onepices_example () {
    // load resume.dat
    let resume_data = new ResumeData('C:/Users/shf/AppData/Roaming/uTorrent/resume.dat')
    
    resume_data.get_torrents('海贼王').forEach( torrent => {
        let episode: number
        
        const dir = 'G:/ACGN/海贼王/'
        
        // 修改任务标题
        torrent.caption = torrent.caption.reformat(
            '[Skytree][海贼王][One_Piece][{episode}][GB_BIG5_JP][X264_AAC][1080P][CRRIP][天空树双语字幕组].mkv',
            '海贼王 {episode}',
            '',
            (name, value) => { episode = +value; return value; }
        )
        
        // 修改种子路径为  G:/ACGN/海贼王/123.torrent
        torrent.fp_torrent = dir + episode + '.torrent'
        
        // 修改文件路径  G:/ACGN/海贼王/123.mkv
        torrent.path = dir + episode + '.mkv'
        
        // 修改文件名
        torrent.targets = [
            [0, episode + '.mkv']
        ]
        
        // 修改 trackers
    })
    
    resume_data.save()
    
    // 删除 uTorrent 配置的 torrent 目录里多余的种子
}


