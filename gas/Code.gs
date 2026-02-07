// Google Apps Script バックエンドコード
// デプロイ方法: 拡張機能 → Apps Script → 新しいプロジェクト → このコードを貼り付け → デプロイ

// スプレッドシートID（.envから取得していたものをここに直接記述）
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'シート1';

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
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'addStation') {
      return addStation(data.station, data.routeName);
    } else if (action === 'deleteStation') {
      return deleteStation(data.station);
    }
    
    return createResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
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
    const fare = fetchFareFromJorudan('根岸', stationName);
    
    if (!fare) {
      return createResponse({ error: 'ジョルダンから運賃を取得できませんでした' }, 500);
    }
    
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
      fare: fare
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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    const url = `https://www.jorudan.co.jp/norikae/cgi/nori.cgi?` +
      `eki1=${encodeURIComponent(from)}` +
      `&eki2=${encodeURIComponent(to)}` +
      `&Dyy=${year}` +
      `&Dmm=${month}` +
      `&Ddd=${day}` +
      `&Dhh=${hour}` +
      `&Dmn1=${Math.floor(minute / 10)}` +
      `&Dmn2=${minute % 10}` +
      `&Cway=0` + // 出発
      `&Cfp=1` + // ICカード優先
      `&Czu=2`; // 料金順
    
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.getContentText('Shift_JIS');
    
    // 運賃を正規表現で抽出
    // 例: <td class="fare">440円</td>
    const fareMatch = html.match(/class="fare[^"]*">([0-9,]+)円/);
    
    if (fareMatch && fareMatch[1]) {
      const fare = parseInt(fareMatch[1].replace(/,/g, ''), 10);
      return fare;
    }
    
    // 別パターンも試す
    const fareMatch2 = html.match(/運賃[：:]\s*([0-9,]+)円/);
    if (fareMatch2 && fareMatch2[1]) {
      const fare = parseInt(fareMatch2[1].replace(/,/g, ''), 10);
      return fare;
    }
    
    Logger.log('運賃が見つかりませんでした: ' + html.substring(0, 500));
    return null;
  } catch (error) {
    Logger.log('ジョルダンスクレイピングエラー: ' + error.toString());
    return null;
  }
}

/**
 * CORS対応レスポンス生成
 */
function createResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // CORS ヘッダー設定
  return output;
}
