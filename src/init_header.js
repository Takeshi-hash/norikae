import 'dotenv/config';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

async function initHeader() {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
        console.error('Error: SPREADSHEET_ID is not set in .env');
        return;
    }

    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // 既存データの確認 (A1セル)
    try {
        const check = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'シート1!A1',
        });

        if (check.data.values && check.data.values.length > 0) {
            console.log('Header already exists (A1 is not empty). Skipping initialization.');
            return;
        }

        // ヘッダー書き込み
        const headerRow = ['路線', '出発', '到着', '備考', '片道', '往復', '主要な施設'];
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'シート1!A1:G1',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [headerRow]
            }
        });
        console.log('Successfully initialized header row.');

    } catch (error) {
        console.error('Failed to initialize header:', error);
    }
}

initHeader();
