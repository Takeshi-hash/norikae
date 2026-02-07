
import { google } from 'googleapis';
import 'dotenv/config';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const yomiganaMap = {
    '東京': 'とうきょう', '有楽町': 'ゆうらくちょう', '新橋': 'しんばし', '浜松町': 'はままつちょう', '品川': 'しながわ', '秋葉原': 'あきはばら', '上野': 'うえの',
    '恵比寿': 'えびす', '目黒': 'めぐろ', '渋谷': 'しぶや', '原宿': 'はらじゅく', '新宿': 'しんじゅく', '西新宿': 'にししんじゅく', '新宿三丁目': 'しんじゅくさんちょうめ', '池袋': 'いけぶくろ',
    '赤坂': 'あかさか', '赤坂見附': 'あかさかみつけ', '溜池山王': 'ためいけさんのう', '六本木': 'ろっぽんぎ', '神谷町': 'かみやちょう', '乃木坂': 'のぎざか', '青山一丁目': 'あおやまいっちょうめ', '赤羽橋': 'あかばねばし',
    '大手町': 'おおてまち', '三越前': 'みつこしまえ', '日本橋': 'にほんばし', '東銀座': 'ひがしぎんざ', '麹町': 'こうじまち', '半蔵門': 'はんぞうもん', '虎ノ門': 'とらのもん', '御成門': 'おなりもん',
    '飯田橋': 'いいだばし', '市ヶ谷': 'いちがや', '水道橋': 'すいどうばし', '信濃町': 'しなのまち', '神楽坂': 'かぐらざか', '護国寺': 'ごこくじ',
    '豊洲': 'とよす', '新豊洲': 'しんとよす', '台場': 'だいば', 'テレコムセンター': 'てれこむせんたー', '国際展示場': 'こくさいてんじじょう',
    '早稲田': 'わせだ', '祖師ヶ谷大蔵': 'そしがやおおくら', '豊島園': 'としまえん'
};

async function addYomiganaColumn() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. 現状のデータを取得
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A:I',
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) return;

    const header = rows[0];
    // A:エリア, B:よみ, C:路線, D:出発, E:到着 ... にしたい
    let hasYomigana = header[1] === 'よみ';

    if (hasYomigana) {
        console.log('Sheet already has Yomigana column.');
    }

    const newRows = rows.map((row, i) => {
        if (i === 0) {
            return hasYomigana ? row : [row[0], 'よみ', ...row.slice(1)];
        }

        const destination = hasYomigana ? row[4] : row[3]; // 到着駅のインデックス
        const yomi = yomiganaMap[destination] || '';

        if (hasYomigana) {
            row[1] = yomi;
            return row;
        } else {
            // [エリア, よみ, 路線, 出発, 到着, ...]
            const newRow = [row[0], yomi, ...row.slice(1)];
            return newRow;
        }
    });

    // 2. クリアして書き込み (列数が増えるので範囲を広げる)
    console.log('Updating spreadsheet with Yomigana column...');
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A1:J1000',
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newRows }
    });

    console.log('Update complete!');
}

addYomiganaColumn().catch(console.error);
