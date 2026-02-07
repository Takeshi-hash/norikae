import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

/**
 * Google Sheetに行を追加する
 * @param {string} spreadsheetId
 * @param {Array<string|number>} rowData [路線, 出発, 到着, 備考, 片道, 往復, 主要な施設]
 */
export async function appendRow(spreadsheetId, rowData) {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const resource = {
        values: [rowData],
    };

    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'シート1!A:A', // 追記するシート名と範囲
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource,
        });
        console.log(`Appended row to sheet: ${response.status}`);
        return response.data;
    } catch (error) {
        console.error('Failed to append row to Google Sheet:', error);
        throw error;
    }
}

/**
 * 特定の到着駅に関連する行をすべて削除する
 * @param {string} spreadsheetId
 * @param {string} destination 到着駅名
 */
export async function deleteRowsByDestination(spreadsheetId, destination) {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const SHEET_NAME = 'シート1';

    try {
        // 0. シート名から実際のsheetIdを取得
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties'
        });

        const targetSheet = spreadsheet.data.sheets.find(
            s => s.properties.title === SHEET_NAME
        );

        if (!targetSheet) {
            throw new Error(`Sheet "${SHEET_NAME}" not found`);
        }

        const sheetId = targetSheet.properties.sheetId;
        console.log(`Found sheetId: ${sheetId} for sheet "${SHEET_NAME}"`);

        // 1. シート全体のデータを取得
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_NAME}!A:H`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found in sheet.');
            return;
        }

        // 2. 削除対象の行番号を特定（逆順で処理するため降順ソート）
        const rowsToDelete = [];
        rows.forEach((row, index) => {
            // row[2] が「到着」列（0-indexed で 2番目）
            if (row[2] === destination) {
                rowsToDelete.push(index);
            }
        });

        if (rowsToDelete.length === 0) {
            console.log(`No rows found for destination: ${destination}`);
            return;
        }

        console.log(`Found ${rowsToDelete.length} rows to delete for destination: ${destination}`);

        // 3. 行を削除（逆順で削除しないとインデックスがずれる）
        // batchUpdateを使って一括削除
        const requests = rowsToDelete.reverse().map(rowIndex => ({
            deleteDimension: {
                range: {
                    sheetId: sheetId, // 動的に取得したsheetIdを使用
                    dimension: 'ROWS',
                    startIndex: rowIndex,
                    endIndex: rowIndex + 1
                }
            }
        }));

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests }
        });

        console.log(`Deleted ${rowsToDelete.length} rows from sheet for destination: ${destination}`);
    } catch (error) {
        console.error('Failed to delete rows from Google Sheet:', error);
        throw error;
    }
}
