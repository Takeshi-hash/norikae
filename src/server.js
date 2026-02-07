import 'dotenv/config';
import express from 'express';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const app = express();
const PORT = 3000;

app.use(express.json());
// P0: 公開ディレクトリを限定（credentials.json, .env などが公開されないようにする）
app.use(express.static(PUBLIC_DIR));

// サーバー終了エンドポイント
app.post('/api/shutdown', (req, res) => {
    res.json({ success: true, message: 'サーバーを終了します...' });
    console.log('Shutdown requested. Closing server...');
    setTimeout(() => process.exit(0), 500);
});

const ROUTES_FILE = path.join(ROOT_DIR, 'routes.json');

// 既存のroutes.jsonを読み込む
async function getRoutes() {
    try {
        const data = await fs.readFile(ROUTES_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

// 経路追加API
app.post('/api/routes', async (req, res) => {
    try {
        const { toStation, routeName } = req.body;

        if (!toStation) {
            return res.status(400).json({ error: 'Station name is required' });
        }

        console.log(`Received request to add route: ${toStation}`);

        const routes = await getRoutes();
        const id = `route_${Date.now()}`;
        const prefix = routeName ? routeName : 'NewRoute';

        const newRoute = {
            id: id,
            route_name: `${prefix}: 根岸-${toStation}`,
            from: '根岸',
            to: toStation,
            datetime_type: 'departure'
        };

        routes.push(newRoute);
        await fs.writeFile(ROUTES_FILE, JSON.stringify(routes, null, 4));

        console.log('Updated routes.json. Starting fare fetch...');

        // 運賃取得を実行 (npm run fetch)
        // 注意: タイムアウト設定などはデフォルト
        const { stdout, stderr } = await execAsync('npm run fetch', { cwd: ROOT_DIR });
        console.log('Fetch stdout:', stdout);
        if (stderr) console.error('Fetch stderr:', stderr);

        res.json({ success: true, message: 'Route added and fares updated', route: newRoute });

    } catch (error) {
        console.error('Error adding route:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// 経路一覧API
app.get('/api/routes', async (req, res) => {
    try {
        const routes = await getRoutes();
        res.json(routes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch routes' });
    }
});

// 経路削除API
app.delete('/api/routes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let routes = await getRoutes();

        const initialLength = routes.length;
        const deletedRoute = routes.find(r => r.id === id);
        routes = routes.filter(r => r.id !== id);

        if (routes.length === initialLength) {
            return res.status(404).json({ error: 'Route not found' });
        }

        await fs.writeFile(ROUTES_FILE, JSON.stringify(routes, null, 4));
        console.log(`Deleted route from routes.json: ${id}`);

        // Google Sheetsから該当する到着駅のデータを削除
        if (deletedRoute && deletedRoute.to) {
            try {
                const spreadsheetId = process.env.SPREADSHEET_ID;
                if (spreadsheetId) {
                    const { deleteRowsByDestination } = await import('./sheet_logger.js');
                    await deleteRowsByDestination(spreadsheetId, deletedRoute.to);
                    console.log(`Deleted rows from spreadsheet for destination: ${deletedRoute.to}`);
                }
            } catch (sheetError) {
                console.error('Failed to delete from spreadsheet:', sheetError);
                // スプレッドシート削除失敗してもroutes.jsonの削除は成功とする
            }
        }

        // fare_data.jsも更新（Google Sheetsから再取得）
        try {
            const { updateLocalData } = await import('./update_local_data.js');
            await updateLocalData();
            console.log('Updated fare_data.js after deletion');
        } catch (updateError) {
            console.error('Failed to update local data:', updateError);
        }

        res.json({ success: true, message: 'Route deleted from all sources' });

    } catch (error) {
        console.error('Error deleting route:', error);
        res.status(500).json({ error: 'Failed to delete route' });
    }
});

// CSVデータ取得API (キャッシュ回避のためAPI化)
app.get('/api/fare-data', async (req, res) => {
    try {
        const FARE_DATA_FILE = path.join(ROOT_DIR, 'fare_data.js');
        const content = await fs.readFile(FARE_DATA_FILE, 'utf-8');

        // JSファイルからCSV部分を抽出 ( `...` の中身)
        const match = content.match(/const FARE_DATA_CSV = `([\s\S]*)`;/);
        if (match && match[1]) {
            res.send(match[1]);
        } else {
            res.status(500).send('Invalid data format');
        }
    } catch (error) {
        console.error('Error serving fare data:', error);
        res.status(500).send('Failed to read data');
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Open this URL in your browser to use the tool.');
});
