
import { google } from 'googleapis';
import 'dotenv/config';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function sortSheet() {
    console.log('Starting spreadsheet sort...');

    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. データの取得
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A:H', // AからH列（路線, 出発, 到着, 備考, 片道, 往復, 主要な施設, 作成日時）
    });

    const rows = res.data.values;
    if (!rows || rows.length <= 1) {
        console.log('No data to sort.');
        return;
    }

    const header = rows[0];
    const dataRows = rows.slice(1);

    // 2. 到着駅 (インデックス2) でソート
    // 日本語（漢字）のソートは localeCompare を使用
    dataRows.sort((a, b) => {
        const valA = a[2] || '';
        const valB = b[2] || '';
        return valA.localeCompare(valB, 'ja');
    });

    const sortedRows = [header, ...dataRows];

    // 3. シートのクリア
    console.log('Clearing existing data...');
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A:H',
    });

    // 4. ソート済みデータの書き込み
    console.log('Writing sorted data...');
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: sortedRows
        }
    });

    console.log(`Successfully sorted ${dataRows.length} stations.`);
}

sortSheet().catch(console.error);
