# Norikae Fare Fetcher

固定経路の運賃をジョルダンから取得し、Google Sheets に記録するツールです。

## セットアップ

1. 依存関係のインストール

   ```bash
   npm install
   ```

2. 設定ファイルの準備
   - `.env` ファイルを作成し、以下を設定してください。
     - `SPREADSHEET_ID`: 書き込み先の Google Spreadsheet ID
     - `GOOGLE_APPLICATION_CREDENTIALS`: Service Account の JSON キーファイルへのパス

3. Google Sheets の準備
   - Google Cloud Console でプロジェクトを作成し、Google Sheets API を有効化してください。
   - Service Account を作成し、JSON キーをダウンロードしてプロジェクトルートに配置してください（例: `credentials.json`）。
   - 作成した Service Account のメールアドレスを、対象のスプレッドシートに「編集者」として共有してください。

4. 経路設定
   - `routes.json` に取得したい経路を定義してください。

   ```json
   [
     {
       "id": "route1",
       "route_name": "通勤",
       "from": "東京",
       "to": "横浜",
       "datetime_type": "departure"
     }
   ]
   ```

## 実行

```bash
npm start
```

- `history.json` に実行履歴が保存され、同一日・同一条件の再取得はスキップされます。
- 新しい経路を `routes.json` に追加した際に実行することで、その経路の運賃のみを取得・追記します。
- 既存の経路を再取得したい場合は、`--force` オプションを使用します。

  ```bash
  node src/index.js --force
  ```

- ジョルダンへの負荷を考慮し、リクエスト間にランダムな待機時間（5-10秒）を設けています。

## かしこい使い方

### 1. 普段の計算（手軽に）

`index.html` をブラウザのブックマークに入れておき、**クリックするだけで** 使います。

- サーバー起動などの難しい操作は一切不要です。
- ネットサーフィンと同じ感覚で使えます。

### 2. 駅を追加・削除したい時（メンテナンス）

フォルダ内の **`norikae_app.command`** をダブルクリックします。

- 自動でサーバーが立ち上がり、管理画面が開きます。
- 作業が終わったら、黒い画面を閉じて終了します。
- 変更内容は自動保存されるので、次回からまた「1」で使えるようになります。
