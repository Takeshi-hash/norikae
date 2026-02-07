import { fetchRouteSearch } from 'japan-transfer-mcp/dist/fetcher.js';
import { parseRouteSearchResult } from 'japan-transfer-mcp/dist/parser.js';
import { DateTime } from 'luxon';

/**
 * 経路情報を元に片道運賃を取得する
 * @param {object} routeConfig
 * @param {string} routeConfig.from 出発駅
 * @param {string} routeConfig.to 到着駅
 * @param {string} routeConfig.datetime_type "departure", "arrival", "first", "last"
 * @param {string} [routeConfig.datetime] "YYYY-MM-DD HH:MM:SS" (省略時は現在時刻)
 * @returns {Promise<number>} 片道運賃(円)
 */
export async function getOneWayFare(routeConfig) {
    const { from, to, datetime_type, datetime } = routeConfig;

    // 日時設定 (日本時間)
    let targetDate;
    if (datetime) {
        targetDate = DateTime.fromFormat(datetime, 'yyyy-MM-dd HH:mm:ss', { zone: 'Asia/Tokyo' });
    } else {
        targetDate = DateTime.now().setZone('Asia/Tokyo');
    }

    if (!targetDate.isValid) {
        throw new Error(`Invalid datetime format: ${datetime}`);
    }

    const query = {
        eki1: from,
        eki2: to,
        Dyy: targetDate.year,
        Dmm: targetDate.month,
        Ddd: targetDate.day,
        Dhh: targetDate.hour,
        Dmn1: Math.floor(targetDate.minute / 10),
        Dmn2: targetDate.minute % 10,
        Cway: requestTypeToCway(datetime_type),
        // デフォルト設定 (ICカード利用など)
        via_on: -1, Cfp: 1, Czu: 2, C7: 1, C2: 0, C3: 0, C1: 0,
        cartaxy: 1, bikeshare: 1, sort: "time", C4: 5, C5: 0, C6: 2, S: "検索",
        rf: "nr", pg: 0,
        eok1: "R-", // 鉄道駅と仮定 (バス停判定は省略)
        eok2: "R-",
        Csg: 1
    };

    try {
        // 運賃取得 (スクレイピング)
        const response = await fetchRouteSearch(query);
        const result = parseRouteSearchResult(response.data);

        if (!result.routes || result.routes.length === 0) {
            throw new Error('No routes found.');
        }

        // 最初のルートの運賃を採用
        const firstRoute = result.routes[0];
        if (!firstRoute.fareInfo || typeof firstRoute.fareInfo.total !== 'number') {
            throw new Error('Fare information not found in the first route.');
        }

        return firstRoute.fareInfo.total;

    } catch (error) {
        console.error(`Failed to fetch fare for ${from} -> ${to}:`, error);
        throw error;
    }
}

function requestTypeToCway(type) {
    switch (type) {
        case "departure": return 0;
        case "arrival": return 1;
        case "first": return 2;
        case "last": return 3;
        default: return 0;
    }
}
