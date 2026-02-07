# Google Apps Script セットアップ手順

## 1. スクリプトプロジェクト作成

1. Google Sheetsを開く（交通費管理用のシート）
2. 「拡張機能」→「Apps Script」をクリック
3. 新しいプロジェクトが開く

## 2. コードを貼り付け

1. `gas/Code.gs` の内容をコピー
2. Apps Scriptエディタに貼り付け
3. `SPREADSHEET_ID` を実際のスプレッドシートIDに置き換え
   - スプレッドシートのURLから取得: `https://docs.google.com/spreadsheets/d/【ここがID】/edit`

## 3. デプロイ

1. 右上の「デプロイ」→「新しいデプロイ」をクリック
2. 種類の選択：「ウェブアプリ」を選択
3. 設定：
   - **説明**: 「Norikae API」
   - **次のユーザーとして実行**: 「自分」
   - **アクセスできるユーザー**: 「全員」（重要！）
4. 「デプロイ」をクリック
5. **ウェブアプリのURL** をコピー（例: `https://script.google.com/macros/s/ABC.../exec`）

## 4. index.html に URL を設定

1. `/Users/Takeshi/Documents/MyObsidian/norikae/index.html` を開く
2. 以下の行を探す:

```javascript
const GAS_API_URL = "YOUR_GAS_DEPLOYMENT_URL_HERE";
```

3. コピーしたURLに置き換え
2. Gitにコミット＆プッシュ

## 5. テスト

1. `https://takeshi-hash.github.io/norikae/` を開く
2. 駅追加フォームに「品川」と入力
3. 「追加」ボタンをクリック
4. 数秒後、Google Sheetsに新しい行が追加されているか確認

## トラブルシューティング

### エラー: "Script function not found"

- Apps Scriptエディタで「保存」を忘れていないか確認

### エラー: "Authorization required"

- デプロイ時に「アクセスできるユーザー: 全員」を選択したか確認

### 運賃が取得できない

- ジョルダンのHTML構造が変更された可能性
- Apps Scriptのログ（表示 → ログ）を確認
