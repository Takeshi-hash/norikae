
import { google } from 'googleapis';
import 'dotenv/config';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const areaMap = {
    // 主要ターミナル
    '東京': '主要ターミナル', '品川': '主要ターミナル', '有楽町': '主要ターミナル', '新橋': '主要ターミナル', '浜松町': '主要ターミナル', '秋葉原': '主要ターミナル', '上野': '主要ターミナル',
    // 渋谷・新宿・池袋
    '恵比寿': '渋谷・新宿・池袋', '目黒': '渋谷・新宿・池袋', '渋谷': '渋谷・新宿・池袋', '原宿': '渋谷・新宿・池袋', '新宿': '渋谷・新宿・池袋', '西新宿': '渋谷・新宿・池袋', '新宿三丁目': '渋谷・新宿・池袋', '池袋': '渋谷・新宿・池袋',
    // 港区（赤坂・六本木・麻布）
    '赤坂': '港区（赤坂・六本木・麻布）', '赤坂見附': '港区（赤坂・六本木・麻布）', '溜池山王': '港区（赤坂・六本木・麻布）', '六本木': '港区（赤坂・六本木・麻布）', '神谷町': '港区（赤坂・六本木・麻布）', '乃木坂': '港区（赤坂・六本木・麻布）', '青山一丁目': '港区（赤坂・六本木・麻布）', '赤羽橋': '港区（赤坂・六本木・麻布）',
    // 千代田・中央オフィス街
    '大手町': '千代田・中央オフィス街', '三越前': '千代田・中央オフィス街', '日本橋': '千代田・中央オフィス街', '東銀座': '千代田・中央オフィス街', '麹町': '千代田・中央オフィス街', '半蔵門': '千代田・中央オフィス街', '虎ノ門': '千代田・中央オフィス街', '御成門': '千代田・中央オフィス街',
    // 中央線・飯田橋・文京エリア
    '飯田橋': '中央線・文京エリア', '市ヶ谷': '中央線・文京エリア', '水道橋': '中央線・文京エリア', '信濃町': '中央線・文京エリア', '神楽坂': '中央線・文京エリア', '護国寺': '中央線・文京エリア',
    // 湾岸エリア
    '豊洲': '湾岸エリア', '新豊洲': '湾岸エリア', '台場': '湾岸エリア', 'テレコムセンター': '湾岸エリア', '国際展示場': '湾岸エリア',
    // その他
    '早稲田': 'その他', '祖師ヶ谷大蔵': 'その他', '豊島園': 'その他'
};

async function updateSheetStructure() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. 現状のデータを取得
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A:H',
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) return;

    // ヘッダー判定（既に「エリア」があるかチェック）
    const header = rows[0];
    let hasArea = header[0] === 'エリア';

    const newRows = rows.map((row, i) => {
        if (i === 0) {
            return hasArea ? row : ['エリア', ...row];
        }

        const destination = hasArea ? row[3] : row[2]; // 到着駅
        const area = areaMap[destination] || 'その他';

        if (hasArea) {
            row[0] = area; // 上書き
            return row;
        } else {
            return [area, ...row]; // 挿入
        }
    });

    // 2. クリアして書き込み
    console.log('Updating spreadsheet with Area column...');
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A:I',
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newRows }
    });

    console.log('Update complete!');
}

updateSheetStructure().catch(console.error);
