import 'dotenv/config';
import fs from 'fs/promises';
import { appendRow } from './sheet_logger.js';
import { parse } from 'csv-parse/sync';

const ORIGINAL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn6vLUs2FmbnirI0FT8gmbMjdA54nVSH9tEKogcfQjS-4LEKAwNeXpC0xp9TXMtinJol4naC04DXy1/pub?gid=0&single=true&output=csv";

async function migrate() {
    console.log('Fetching original CSV...');
    const response = await fetch(ORIGINAL_CSV_URL);
    const csvText = await response.text();

    console.log('Parsing CSV...');
    const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true
    });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
        console.error('SPREADSHEET_ID not set');
        return;
    }

    console.log(`Found ${records.length} records. Migrating...`);

    for (const row of records) {
        // Original: 路線,出発,到着,,片道,主要な施設
        // Target:   路線,出発,到着,備考,片道,往復,主要な施設

        const routeName = row['路線'];
        const from = row['出発'];
        const to = row['到着'];
        const fare = parseInt(row['片道'], 10);
        const facility = row['主要な施設'];

        if (!to || isNaN(fare)) continue;

        const roundTrip = fare * 2;
        const note = 'migrated_data';

        const rowData = [
            routeName,
            from,
            to,
            note,
            fare,
            roundTrip,
            facility
        ];

        try {
            await appendRow(spreadsheetId, rowData);
            console.log(`Migrated: ${to} (${fare}円)`);
            // Rate limit protection
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.error(`Failed to migrate ${to}:`, e.message);
        }
    }
    console.log('Migration complete.');
}

migrate();
