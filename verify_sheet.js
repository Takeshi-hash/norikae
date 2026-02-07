
import { google } from 'googleapis';
import 'dotenv/config';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function check() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A:H', // 全列取得して確認
    });

    const rows = res.data.values || [];
    console.log(`Total rows: ${rows.length}`);

    if (rows.length > 0) {
        console.log('Header:', rows[0].join(', '));
        // サンプルとして数行表示
        rows.slice(1, 4).forEach((row, i) => {
            console.log(`Row ${i + 1}:`, row.join('|'));
        });
    }

    const destinations = rows.map(r => r[3]); // 4列目(D列)が到着駅
    console.log('\n--- check specific (D column) ---');
    console.log('六本木:', destinations.includes('六本木') ? '✅ YES' : '❌ NO');
    console.log('品川:', destinations.includes('品川') ? '✅ YES' : '❌ NO');
}

check().catch(console.error);
