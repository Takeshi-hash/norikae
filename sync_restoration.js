
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { google } from 'googleapis';
import 'dotenv/config';

// バックアップCSV（復元元）
const BACKUP_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRn6vLUs2FmbnirI0FT8gmbMjdA54nVSH9tEKogcfQjS-4LEKAwNeXpC0xp9TXMtinJol4naC04DXy1/pub?gid=0&single=true&output=csv';

// アクティブなスプレッドシートID
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function sync() {
    console.log('Starting sync...');

    // 1. バックアップCSVを取得
    console.log('Fetching backup CSV...');
    const response = await fetch(BACKUP_CSV_URL);
    const csvText = await response.text();
    const backupRecords = parse(csvText, { columns: true, skip_empty_lines: true });
    console.log(`Backup records: ${backupRecords.length}`);

    // 2. 現在のスプレッドシートを取得
    console.log('Fetching active spreadsheet...');
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const sheetRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'シート1!A:C', // 路線,出発,到着 をチェック
    });

    const currRows = sheetRes.data.values || [];
    const currDestinations = new Set(currRows.slice(1).map(row => row[2])); // 到着駅
    console.log(`Current active records: ${currDestinations.size}`);

    // 3. 差分を抽出
    const missing = backupRecords.filter(rec => !currDestinations.has(rec['到着']));
    console.log(`Missing records to add: ${missing.length}`);

    if (missing.length === 0) {
        console.log('No missing records found.');
        return;
    }

    // 4. 追加
    for (const rec of missing) {
        process.stdout.write(`Adding ${rec['到着']}... `);

        // CSV: 路線,出発,到着,,片道,主要な施設
        // Sheet columns: 路線, 出発, 到着, 備考, 片道, 往復, 主要な施設, 作成日時
        const row = [
            rec['路線'],
            rec['出発'],
            rec['到着'],
            'restored', // 備考
            rec['片道'],
            parseInt(rec['片道']) * 2, // 往復
            rec['主要な施設'] || '',
            new Date().toISOString()
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'シート1!A:H',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [row] }
        });
        console.log('Done');

        // APIレート制限考慮
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('Sync complete!');
}

sync().catch(console.error);
