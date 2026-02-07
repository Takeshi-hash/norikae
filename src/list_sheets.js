import 'dotenv/config';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

async function listSheets() {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId,
        });
        console.log('Sheet Titles:', response.data.sheets.map(s => s.properties.title));
    } catch (error) {
        console.error('Error fetching sheet list:', error);
    }
}

listSheets();
