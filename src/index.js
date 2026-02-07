import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { DateTime } from 'luxon';
import { getOneWayFare } from './fare_fetcher.js';
import { appendRow } from './sheet_logger.js';
import { updateLocalData } from './update_local_data.js';

const ROUTES_FILE = './routes.json';
const HISTORY_FILE = './history.json';
const RETRY_COUNT = 1;
const WAIT_MIN_MS = 5000;
const WAIT_MAX_MS = 10000;

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

async function main() {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
        console.error('Error: SPREADSHEET_ID is not set in .env');
        return;
    }

    // ルート設定の読み込み
    let routes;
    try {
        const data = await fs.readFile(ROUTES_FILE, 'utf-8');
        routes = JSON.parse(data);
    } catch (error) {
        console.error('Failed to read routes.json:', error);
        return;
    }

    // 履歴の読み込み
    let history = {};
    try {
        const data = await fs.readFile(HISTORY_FILE, 'utf-8');
        history = JSON.parse(data);
    } catch (error) {
        // ファイルがない場合は空で続行
    }

    const runId = DateTime.now().setZone('Asia/Tokyo').toFormat('yyyyMMdd-HHmmss');
    const today = DateTime.now().setZone('Asia/Tokyo').toFormat('yyyy-MM-dd');

    const rl = readline.createInterface({ input, output });
    const forceUpdate = process.argv.includes('--force');

    try {
        for (const route of routes) {
            const cacheKey = generateCacheKey(route, today);

            // 履歴チェック (同一条件での実行済み確認)
            // --force フラグがある場合は履歴を無視して再取得
            if (!forceUpdate && history[cacheKey]) {
                console.log(`Skipping ${route.route_name} (Already fetched for ${cacheKey})`);
                continue;
            }

            console.log(`Processing ${route.route_name} (${route.from} -> ${route.to})...`);

            let fare = null;
            for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
                try {
                    // 待機 (初回もリクエスト前に入れるか、2回目以降か。要件は「経路間は5-10秒待つ」なので、前の処理後に入れるのが適切だが、ここでは実行前にランダムウェイトを入れる方針で安全側に倒す)
                    if (attempt > 0) {
                        console.log(`  Retry attempt ${attempt}...`);
                        await wait(WAIT_MIN_MS, WAIT_MAX_MS);
                    } else {
                        // 最初のアクセスでも、直前の処理から時間が経っていない可能性を考慮し、ウェイトを入れるのが無難
                        // ただし、ループの先頭で待つと最初の1件目が遅くなる。
                        // ここでは「前のループの終わり」で待つのではなく、「実行前」に待つ形にする。(初回は即時でも良いが、安全のため)
                    }

                    fare = await getOneWayFare(route);
                    break; // 成功したらループを抜ける

                } catch (error) {
                    console.error(`  Error fetching fare: ${error.message}`);
                    if (attempt === RETRY_COUNT) {
                        console.error(`  Failed after ${RETRY_COUNT} retries.`);
                    }
                }
            }

            if (fare !== null) {
                console.log(`  Fetched Fare: ${fare}円`);

                // 強制更新時は確認を求める
                if (forceUpdate) {
                    const answer = await rl.question('  Update Google Sheet? (y/N): ');
                    if (answer.trim().toLowerCase() !== 'y') {
                        console.log('  Skipped update.');
                        continue; // 次のrouteへ
                    }
                }

                const roundTripFare = fare * 2;
                const rowData = [
                    route.area || 'その他', // エリア
                    route.yomi || '',       // よみ
                    route.route_name.split(':')[0], // 路線
                    route.from,       // 出発
                    route.to,         // 到着
                    `${today} ${runId}`, // 備考
                    fare,             // 片道
                    roundTripFare,    // 往復
                    route.facility || '', // 主要な施設
                    new Date().toISOString() // 作成日時
                ];

                try {
                    await appendRow(spreadsheetId, rowData);
                    console.log(`  Logged result: One-way ${fare}円`);

                    // 履歴更新
                    history[cacheKey] = {
                        timestamp: new Date().toISOString(),
                        fare: fare
                    };
                    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));

                } catch (logError) {
                    console.error(`  Failed to log to Sheet: ${logError.message}`);
                }
            }

            // 次の経路への待機 (要件: 5~10秒)
            await wait(WAIT_MIN_MS, WAIT_MAX_MS);
        }
        // ...
    } finally {
        rl.close();
    }

    // データ同期
    console.log('Synchronizing local data...');
    try {
        const { updateLocalData } = await import('./update_local_data.js');
        await updateLocalData();
    } catch (e) {
        console.error('Failed to sync local data:', e);
    }
}

function generateCacheKey(route, today) {
    // datetime指定がある場合はそれを含める
    if (route.datetime) {
        return `${route.id}_${route.datetime}`;
    }
    // 指定がない場合は「今日」の日付をキーにする
    return `${route.id}_${today}`;
}

function wait(min, max) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
}

main();
