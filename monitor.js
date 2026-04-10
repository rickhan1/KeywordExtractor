const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const STATE_FILE = path.join(__dirname, 'state', 'last_checked.json');
const DATA_DIR = path.join(__dirname, 'data', 'daily_hints');

// Ensure directories exist
if (!fs.existsSync(path.dirname(STATE_FILE))) fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initial State
let state = { sbs: null, kbs: null };
if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

async function sendTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('Telegram credentials missing. Skipping notification.');
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        });
        console.log('Telegram notification sent.');
    } catch (error) {
        console.error('Error sending Telegram message:', error.message);
    }
}

async function monitorSBS() {
    console.log('Monitoring SBS...');
    const listUrl = 'https://programs.sbs.co.kr/culture/today3/boards/54208';
    try {
        const response = await axios.get(listUrl);
        concns $ = cheerio.load(response.dt;
        
        // Find the first post link in the table
        const firstPost = $('td.table_col_title a').first();
        if (!firstPst.length) return;

        const title = firstPost.text().trim();
        const href = firstPost.attr('href');
        const boardNo = href.match(/board_no=(\d+)/)?.[1];

        if (boardNo && boardNo !== state.sbs) {
            console.log(`New SBS Post Found: ${title}`);
            const detailUrl = `https://programs.sbs.co.kr/culture/today3/board/54208?cmd=view&board_no=${boardNo}`;
            
            const message = `🔔 <b>[신규 방송 정보] SBS 생방송 투데이</b>\n\n` +
                          `- 주제: ${title}\n` +
                          `- 추천 카테고리: [생활], [경제], [의학]\n\n` +
                          `🔗 <b>출처 바로가기:</b> <a href="${detailUrl}">상세 정보 보기</a>`;
            
            await sendTelegram(message);
            state.sbs = boardNo;
            saveState();
        }
    } catch (error) {
        console.error('Error monitoring SBS:', error.message);
    }
}

async function monitorKBS() {
    console.log('Monitoring KBS...');
    const apiUrl = 'https://cfpbbsapi.kbs.co.kr/board/v1/list?bbs_id=T2000-0093-04-732468&page=1&sort_order=01';
    try {
        const response = await axios.get(apiUrl);
        const latestPost = response.data.board_list?.[0];
        
        if (latestPost && latestPost.post_id !== state.kbs) {
            console.log(`New KBS Post Found: ${latestPost.p_title}`);
            const detailUrl = `https://pbbs.kbs.co.kr/general/read.html?bbs_id=T2000-0093-04-732468&id=${latestPost.post_id}`;
            
            const message = `🔔 <b>[신규 방송 정보] KBS 6시 내고향</b>\n\n` +
                          `- 주제: ${latestPost.p_title}\n` +
                          `- 추천 카테고리: [생활], [의학], [지역경제]\n\n` +
                          `🔗 <b>출처 바로가기:</b> <a href="${detailUrl}">상세 정보 보기</a>`;
            
            await sendTelegram(message);
            state.kbs = latestPost.post_id;
            saveState();
        }
    } catch (error) {
        console.error('Error monitoring KBS:', error.message);
    }
}

function saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function run() {
    await monitorSBS();
    await monitorKBS();
    console.log('Monitoring cycle complete.');
}

run();
