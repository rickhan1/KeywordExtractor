const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const STATE_FILE = path.join(__dirname, 'state', 'last_checked.json');

// state directory creation
if (!fs.existsSync(path.dirname(STATE_FILE))) {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
}

let state = { sbs: null, kbs: null };
if (fs.existsSync(STATE_FILE)) {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState() {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
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
                    const $ = cheerio.load(response.data);

            // Find the first post link in the table
            const firstPost = $('td.table_col_title a').first();
                    if (!firstPost.length) return;

            const title = firstPost.text().trim();
                    const href = firstPost.attr('href');
                    const boardNo = href.match(/board_no=(\d+)/)?.[1];

            if (boardNo && boardNo !== state.sbs) {
                            console.log(`New SBS Post Found: ${title}`);
                            const detailUrl = `https://programs.sbs.co.kr/culture/today3/board/54208?cmd=view&board_no=${boardNo}`;
                            const message = `[[NEW] SBS Today\n\n- Title: ${title}\n- Link: <a href="${detailUrl}">View</a>`;

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
        const apiUrl = 'https://cfpbbsapi.kbs.co.kr/board/v1/list?bbs_id=T2000-0093-04-732468&page=1&sort_field=reg_dt&sort_order=desc';
        try {
                    const response = await axios.get(apiUrl);
                    const posts = response.data?.data?.list;
                    if (!posts || posts.length === 0) return;

            const firstPost = posts[0];
                    const boardNo = String(firstPost.board_no);
                    const title = firstPost.title;

            if (boardNo !== state.kbs) {
                            console.log(`New KBS Post Found: ${title}`);
                            const detailUrl = `https://pbbs.kbs.co.kr/general/list.html?bbs_id=T2000-0093-04-732468&page=1`;
                            const message = `[NEW] KBS Today\n\n- Title: ${title}\n- Link: <a href="${detailUrl}">View</a>`;

                        await sendTelegram(message);
                            state.kbs = boardNo;
                            saveState();
            }
        } catch (error) {
                    console.error('Error monitoring KBS:', error.message);
        }
}

async function run() {
        await monitorSBS();
        await monitorKBS();
}

run();
