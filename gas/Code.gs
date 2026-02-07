// Google Apps Script バックエンドコード
// デプロイ方法: 拡張機能 → Apps Script → 新しいプロジェクト → このコードを貼り付け → デプロイ

// スプレッドシートID（.envから取得していたものをここに直接記述）
const SPREADSHEET_ID = '10_YVIh9LJ-vZd-H__5vHveIoSQRe4XI5KGY2-9Iy3No';
const SHEET_NAME = 'シート1';
const JORUDAN_SEARCH_URL = 'https://www.jorudan.co.jp/norikae/cgi/nori.cgi';

/**
 * OPTIONS リクエスト処理（CORS preflight）
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * GETリクエスト処理
 */
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getStations') {
    return getStations();
  }
  
  return createResponse({ error: 'Unknown action' }, 400);
}

/**
 * POSTリクエスト処理
 */
function doPost(e) {
  try {
    console.log('doPost called');
    console.log('e.postData:', e.postData);
    console.log('e.postData.contents:', e.postData ? e.postData.contents : 'N/A');

    if (!e || !e.postData || !e.postData.contents) {
      return createResponse({ error: 'Request body is required' }, 400);
    }

    const data = JSON.parse(e.postData.contents);
    console.log('Parsed data:', data);
    console.log('Action:', data.action);
    
    const action = data.action;
    
    if (action === 'addStation') {
      console.log('Calling addStation with:', data.station, data.routeName);
      return addStation(data.station, data.routeName);
    } else if (action === 'deleteStation') {
      console.log('Calling deleteStation with:', data.station);
      return deleteStation(data.station);
    }
    
    console.log('Unknown action:', action);
    return createResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('doPost error:', error);
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * 駅一覧取得
 */
function getStations() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    // ヘッダー行をスキップ
    const stations = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[2]) { // 到着駅がある行のみ
        stations.push({
          destination: row[2],
          routeName: row[0],
          fare: row[4]
        });
      }
    }
    
    // 重複除去
    const unique = [...new Map(stations.map(s => [s.destination, s])).values()];
    
    return createResponse({ success: true, stations: unique });
  } catch (error) {
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * 駅追加
 */
function addStation(stationName, routeName) {
  try {
    if (!stationName) {
      return createResponse({ error: '駅名が必要です' }, 400);
    }
    
    // ジョルダンから運賃取得
    const fareResult = fetchFareFromJorudan('根岸', stationName);
    
    if (!fareResult.success) {
      return createResponse({
        error: 'ジョルダンから運賃を取得できませんでした',
        code: fareResult.code,
        details: fareResult.details,
        status: fareResult.status || null
      }, 502);
    }

    const fare = fareResult.fare;
    
    // Google Sheetsに記録
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    const route = routeName || 'NewRoute';
    
    const newRow = [
      `${route}: 根岸-${stationName}`, // 路線
      '根岸',                           // 出発
      stationName,                      // 到着
      timestamp,                        // 備考
      fare,                             // 片道
      fare * 2,                         // 往復
      ''                                // 主要な施設（空欄）
    ];
    
    sheet.appendRow(newRow);
    
    return createResponse({
      success: true,
      message: '駅を追加しました',
      fare: fare,
      source: fareResult.source
    });
  } catch (error) {
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * 駅削除
 */
function deleteStation(stationName) {
  try {
    if (!stationName) {
      return createResponse({ error: '駅名が必要です' }, 400);
    }
    
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    let deletedCount = 0;
    // 逆順で削除（インデックスのずれを防ぐため）
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][2] === stationName) { // 到着駅が一致
        sheet.deleteRow(i + 1); // 1-indexed
        deletedCount++;
      }
    }
    
    return createResponse({
      success: true,
      message: `${deletedCount}行を削除しました`,
      deletedCount: deletedCount
    });
  } catch (error) {
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * ジョルダンから運賃取得
 */
function fetchFareFromJorudan(from, to) {
  try {
    console.log(`fetchFareFromJorudan called: from=${from}, to=${to}`);
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    const url = `${JORUDAN_SEARCH_URL}?` +
      `eki1=${encodeURIComponent(from)}` +
      `&eki2=${encodeURIComponent(to)}` +
      `&Dyy=${year}` +
      `&Dmm=${month}` +
      `&Ddd=${day}` +
      `&Dhh=${hour}` +
      `&Dmn1=${Math.floor(minute / 10)}` +
      `&Dmn2=${minute % 10}` +
      `&Cway=0` + // 出発
      `&via_on=-1` +
      `&Cfp=1` +  // ICカード優先
      `&Czu=2` +
      `&C7=1` +
      `&C2=0` +
      `&C3=0` +
      `&C1=0` +
      `&cartaxy=1` +
      `&bikeshare=1` +
      `&sort=time` +
      `&C4=5` +
      `&C5=0` +
      `&C6=2` +
      `&S=${encodeURIComponent('検索')}` +
      `&rf=nr` +
      `&pg=0` +
      `&eok1=R-` +
      `&eok2=R-` +
      `&Csg=1`;
    
    console.log('Jorudan URL:', url);
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const status = response.getResponseCode();
    console.log('Jorudan response status:', status);
    if (status !== 200) {
      return {
        success: false,
        code: 'jorudan_http_error',
        details: `Jorudan HTTP status ${status}`,
        status: status
      };
    }
    
    let html = '';
    try {
      html = response.getContentText('Shift_JIS');
    } catch (e) {
      // エンコーディングが変わった場合に備えてフォールバック
      html = response.getContentText();
    }

    console.log('HTML length:', html.length);
    console.log('HTML preview (first 500 chars):', html.substring(0, 500));

    const parsed = extractFareFromHtml(html);
    if (parsed.fare !== null) {
      console.log(`Found fare (${parsed.source}):`, parsed.fare);
      return {
        success: true,
        fare: parsed.fare,
        source: parsed.source
      };
    }

    console.error('運賃が見つかりませんでした');
    const isBlocked = /アクセスが集中|しばらくしてから|Robot|bot|captcha|利用を制限/i.test(html);
    return {
      success: false,
      code: isBlocked ? 'jorudan_blocked' : 'fare_parse_failed',
      details: isBlocked
        ? 'ジョルダン側でアクセス制限された可能性があります'
        : '運賃の抽出に失敗しました（ジョルダンのHTML構造変更の可能性）',
      status: status
    };
  } catch (error) {
    console.error('ジョルダンスクレイピングエラー:', error.toString());
    console.error('Error stack:', error.stack);
    return {
      success: false,
      code: 'jorudan_fetch_exception',
      details: error.toString()
    };
  }
}

function extractFareFromHtml(html) {
  const patterns = [
    {
      source: 'class_fare',
      regex: /class=["']fare[^"']*["'][^>]*>\s*([0-9,]+)\s*円/i
    },
    {
      source: 'label_unchin',
      regex: /運賃(?:\s|<[^>]+>|[：:])+([0-9,]+)\s*円/i
    },
    {
      source: 'label_ic',
      regex: /IC(?:運賃|料金)?(?:\s|<[^>]+>|[：:])+([0-9,]+)\s*円/i
    }
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = html.match(patterns[i].regex);
    if (match && match[1]) {
      const fare = parseInt(match[1].replace(/,/g, ''), 10);
      if (!isNaN(fare) && fare > 0) {
        return { fare: fare, source: patterns[i].source };
      }
    }
  }

  // 最終フォールバック: "xxx円" の候補から最小額を採用（往復より片道を優先）
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  const fareCandidates = [];
  const fallbackRegex = /([0-9]{2,5})\s*円/g;
  let match;
  while ((match = fallbackRegex.exec(textOnly)) !== null) {
    const fare = parseInt(match[1], 10);
    if (!isNaN(fare) && fare >= 50 && fare <= 50000) {
      fareCandidates.push(fare);
    }
  }

  if (fareCandidates.length > 0) {
    const minFare = Math.min.apply(null, fareCandidates);
    return { fare: minFare, source: 'fallback_min_yen' };
  }

  return { fare: null, source: null };
}

/**
 * CORS対応レスポンス生成
 */
function createResponse(data, statusCode = 200) {
  const payload = Object.assign({ statusCode: statusCode }, data);
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
