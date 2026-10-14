# 依存更新・セキュリティ検証（2026-10-15）

オープン依存更新PR15件を1本に統合。個別マージによるPages公開の繰り返しを避ける。Pagesの起動条件は変更しない。

## npm監査

更新前は脆弱性報告のある14パッケージ（high 10 / moderate 3 / low 1）。これはCoral上で実証された14件の攻撃経路を意味しない。更新後は全依存を含む `npm audit` が0件。

| パッケージ | 更新前 | 更新後 | 監査の分類 |
|---|---|---|---|
| @babel/core | 7.28.5 | 7.29.7 | low |
| @humanfs/node | 0.16.7 | 0.16.8 | moderate |
| ajv | 6.12.6 | 6.15.0 | moderate |
| baseline-browser-mapping | 2.9.7 | 2.11.28 | moderate |
| brace-expansion | 1.1.12 | 1.1.21 | high |
| browserslist | 4.28.1 | 4.29.3 | high |
| flatted | 3.3.3 | 3.4.4 | high |
| js-yaml | 4.1.1 | 4.3.2 | high |
| lodash | 4.17.21 | 4.18.1 | high |
| minimatch | 3.1.2 | 3.1.5 | high |
| nanoid | 3.3.11 | 3.3.20 | high |
| postcss | 8.5.8 | 8.5.30 | high |
| source-map-js | 1.2.1 | 1.2.2 | high |
| vite | 8.0.8 | 8.3.4 | high |

ViteのWindowsアクセス制限回避はネットワーク公開された開発サーバー等の条件を必要とする。PostCSS/Babelのソースマップ読み取り、glob/YAML関連のCPU・メモリ枯渇、lodash等の特定APIによるコード注入/オブジェクト汚染の報告を含む。多くは開発依存。Dagre経由のlodashは実行時依存だが、Coralから危険APIへの到達を実証したわけではない。

## Rust

RustSecは重大な脆弱性0件、anyhow 1.0.102のunsound警告 RUSTSEC-2026-0190を報告。Error::context後のdowncast_mutで借用規則違反が起きる。Coralにdowncast_mut呼び出しはないが、修正版1.0.103に更新。thiserror 2.0.20はRust 1.99のClippyと生成コードの互換性修正（脆弱性とは別）。

## 検証

- npm ci、npm audit、lint、通常ビルド・静的ビルド。
- cargo fmt、cargo test --locked、cargo clippy --all-targets --locked -- -D warnings、cargo audit。
- TypeScript 6: baseUrlを削除しpathsを相対指定に変更。React/React DOMは19.2.5で一致。
- Actionsは既存PRの公式リリースSHAを維持。github-script v9のrequire/getOctokit破壊的変更に該当する利用はない。
- Cargo.lockの変更をCI起動対象に追加、CIにnpm監査とlocked指定を追加。
- Dependabotはエコシステム別にminor/patchとセキュリティ更新をグループ化。メジャー更新は独立検証を続ける。

## 出典

- https://github.com/advisories/GHSA-fx2h-pf6j-xcff
- https://github.com/advisories/GHSA-6g55-p6wh-862q
- https://github.com/advisories/GHSA-r5fr-rjxr-66jc
- https://github.com/advisories/GHSA-3ppc-4f35-3m26
- https://rustsec.org/advisories/RUSTSEC-2026-0190.html
- https://github.com/dtolnay/thiserror/releases/tag/2.0.20
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
