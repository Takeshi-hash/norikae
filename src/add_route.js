import 'dotenv/config';
import fs from 'fs/promises';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ROUTES_FILE = './routes.json';

async function main() {
    const rl = readline.createInterface({ input, output });

    try {
        console.log('--- 新規経路追加ウィザード ---');

        // 1. 駅名入力
        const toStation = await rl.question('到着駅を入力してください (例: 渋谷): ');
        if (!toStation.trim()) {
            console.log('キャンセルしました。');
            return;
        }

        // 2. 路線名 (任意)
        const routeNameInput = await rl.question('路線名を入力してください (Enterでスキップ): ');
        const routeNamePrefix = routeNameInput.trim() ? routeNameInput.trim() : 'NewRoute';

        // 3. 施設名 (任意)
        // 今のnorikaeツールではroutes.jsonに施設名は必須ではないが、
        // 将来的に管理したい場合はここで聞く。今回はスキップでも良いが、
        // Sheetの「主要な施設」列に手動で入れたい場合があるため、一応聞いておくか、
        // 自動取得時は空になるので、ここではroutes.jsonに入れるだけにする。
        // routes.jsonの仕様を確認すると、facilityフィールドはない。
        // なので、ここはスキップ。

        // ID生成
        // 単純にランダムか、ローマ字変換があればいいが、ライブラリ追加も手間なので
        // timestampを使う
        const id = `route_${Date.now()}`;

        const newRoute = {
            id: id,
            route_name: `${routeNamePrefix}: 根岸-${toStation}`,
            from: '根岸',
            to: toStation,
            datetime_type: 'departure'
            // datetimeは指定なし（現在時刻=直近の出発として扱う）
        };

        // ファイル読み込み
        let routes = [];
        try {
            const data = await fs.readFile(ROUTES_FILE, 'utf-8');
            routes = JSON.parse(data);
        } catch (e) {
            // ファイルがなければ空配列
        }

        // 追加
        routes.push(newRoute);

        // 書き込み
        await fs.writeFile(ROUTES_FILE, JSON.stringify(routes, null, 4));
        console.log(`\n経路を追加しました: 根岸 -> ${toStation}`);

        // 4. 即時実行確認
        const fetchNow = await rl.question('今すぐ運賃を取得してスプレッドシートに追記しますか？ (Y/n): ');
        if (fetchNow.trim().toLowerCase() !== 'n') {
            console.log('運賃取得を開始します...');
            rl.close(); // execの前に閉じる

            // npm startを実行 (forceなしでOK、新規IDなので)
            // ただし、routes.jsonが増えているので、対象だけやる機能はないが、
            // 既存の履歴があればスキップされるので問題ない。

            try {
                const { stdout, stderr } = await execAsync('npm run fetch');
                console.log(stdout);
                if (stderr) console.error(stderr);
            } catch (e) {
                console.error('実行中にエラーが発生しました:', e);
            }
            return;
        }

    } catch (error) {
        console.error('エラー:', error);
    } finally {
        rl.close();
    }

    // データ同期 (npm startが走らなかった場合でも一応やっておく、あるいはnpm start内でやられるので重複するが問題ない)
    console.log('Synchronizing local data...');
    try {
        const { updateLocalData } = await import('./update_local_data.js');
        await updateLocalData();
    } catch (e) {
        console.error('Failed to sync local data:', e);
    }
}

main();
