# 沈下板観測 Field

軟弱地盤動態観測システム向けの現場入力PWAです。スマートフォンで沈下板観測値を入力し、ObservationモデルとしてIndexedDBへ保存します。

## 主な機能

- 路線・測点・観測位置・BMマスタ管理
- 測点自動生成
- BM標高、後視値、前視値から器械高、ロッド天端標高を自動計算
- ロッド初期長、継ぎ足し履歴、累積ロッド長を管理
- 沈下板標高、累積沈下量、日沈下量を自動計算
- 前回観測値表示と異常値警告
- IndexedDB保存、LocalStorageによる前回作業復元
- 全履歴CSV、当日CSV、JSON出力
- CSV取込の追記、上書き
- PWA manifest、service worker対応

## 開発

```bash
npm install
npm run dev -- --port 3100
```

## 検証

```bash
npm run typecheck
npm run build
```

## GitHub Pages公開

このプロジェクトには `.github/workflows/pages.yml` が含まれています。GitHubリポジトリの `main` ブランチへpushすると、GitHub Actionsが静的サイトをビルドし、GitHub Pagesへ公開します。

1. GitHubで `settlement-plate-observation` というリポジトリを作成
2. このフォルダをリポジトリへpush
3. GitHubのリポジトリ画面で `Settings` -> `Pages` を開く
4. `Build and deployment` の `Source` を `GitHub Actions` に設定
5. `Actions` の `Deploy GitHub Pages` が完了すると公開URLが発行されます

想定URL:

```text
https://<GitHubユーザー名>.github.io/settlement-plate-observation/
```

リポジトリ名を変える場合も、Actions側で自動的に `/<リポジトリ名>/` をbase pathとしてビルドします。

## データ構造

観測履歴は `src/lib/types.ts` の `Observation` を中心に管理します。将来のSupabase、PostgreSQL、PowerBI、PDF帳票連携では、このモデルを境界としてデータ連携できます。
