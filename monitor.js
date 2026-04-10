const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * [KeywordExtractor V1.0]
 * 방송사 공식 게시판 무인 모니터링 및 텔레그램 알림 시스템
 */

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const STATE_FILE = path.join(__dirname, 'state', 'last_checked.json');

// Ensure state directory exists
if (!fs.existsSync(path.dirname(STATE_FILE))) {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
}

// Initial State
let state = { sbs: "0", kbs: "0" };
if (fs.existsSync(STATE_FILE)) {
    try {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
        console.error('[Error] State file corrupted, using default values.');
    }
}

async function sendTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        });
        console.log('Done: Telegram notification forwarded to CEO.');
    } catch (error) {
        console.error('[Error] Telegram delivery failed:', error.response?.data || error.message);
    }
}

async function monitorSBS() {
    console.log('Running: SBS Board Scan...');
    const listUrl = 'https://programs.sbs.co.kr/culture/today3/boards/54208';
    try {
        const response = await axios.get(listUrl);
        const $ = cheerio.load(response.data);
        
        // Find the most recent post
        const firstPost = $('a[href*="board_no="]').first();
        if (!firstPost.length) return;

        const title = firstPost.text().trim();
        const href = firstPost.attr('href');
        const boardNo = href.match(/board_no=(\d+)/)?.[1];

        if (boardNo && boardNo !== state.sbs) {
            console.log(`Update: New SBS broadcast found (${title})`);
            const detailUrl = `https://programs.sbs.co.kr/culture/today3/board/54208?cmd=view&board_no=${boardNo}`;
            
            const message = `✨ <b>[에디터 픽] 신규 방송 소싱 알림</b>\n\n` +
                          `📺 <b>SBS 생방송 투데이</b>\n` +
                          `📝 <b>주제:</b> ${title}\n` +
                          `🏷 <b>추천:</b> #생활 #소비경제 #트렌드\n\n` +
                          `🔗 <b>상세정보 확인:</b> <a href="${detailUrl}">공식 게시판 바로가기</a>\n\n` +
                          `<i>* 위 링크에서 키워드를 확인 후 기사 작성을 요청해주세요.</i>`;
            
            await sendTelegram(message);
            state.sbs = boardNo;
            saveState();
        }
    } catch (error) {
        console.error('[Error] SBS Scan failed:', error.message);
    }
}

async function monitorKBS() {
    console.log('Running: KBS Board Scan...');
    const apiUrl = 'https://cfpbbsapi.kbs.co.kr/board/v1/list?bbs_id=T2000-0093-04-732468&page=1&sort_order=01';
    try {
        const response = await axios.get(apiUrl);
        const latestPost = response.data.data?.[0];
        
        if (latestPost && String(latestPost.id) !== String(state.kbs)) {
            console.log(`Update: New KBS broadcast found (${latestPost.post_title})`);
            const detailUrl = latestPost.target_url || `https://pbbs.kbs.co.kr/general/read.html?bbs_id=T2000-0093-04-732468&id=${latestPost.id}`;
            
            const message = `✨ <b>[에디터 픽] 신규 방송 소싱 알림</b>\n\n` +
                          `📺 <b>KBS 6시 내고향</b>\n` +
                          `📝 <b>주제:</b> ${latestPost.post_title}\n` +
                          `🏷 <b>추천:</b> #지역경제 #식품영양 #건강\n\n` +
                          `🔗 <b>상세정보 확인:</b> <a href="${detailUrl}">공식 게시판 바로가기</a>\n\n` +
                          `<i>* 위 링크에서 키워드를 확인 후 기사 작성을 요청해주세요.</i>`;
            
            await sendTelegram(message);
            state.kbs = String(latestPost.id);
            saveState();
        }
    } catch (error) {
        console.error('[Error] KBS Scan failed:', error.message);
    }
}

function saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function run() {
    await monitorSBS();
    await monitorKBS();
    console.log('Status: Automation cycle successfully completed.');
}

run();
