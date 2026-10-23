# StockCharts userscripts

Small [Violentmonkey](https://violentmonkey.github.io/) userscripts for StockCharts and Finviz.

## Scripts

- [Asymmetric Two-Chart Layout](scripts/stockcharts-acp-asymmetric-two-chart-layout.user.js) — makes horizontal two-chart layouts one-third left and two-thirds right.
- [ChartList Shortcuts](scripts/stockcharts-acp-chartlist-shortcuts.user.js) — navigates ChartLists with `[` and `]`.
- [Download Chart Shortcut](scripts/stockcharts-acp-download-chart.user.js) — downloads the current ACP chart layout with `Option+Shift+C` and names it from the applied layout, symbols, and timestamp.
- [Starred Symbols](scripts/stockcharts-acp-starred-symbols.user.js) — stars ChartList symbols and copies them into a new ChartList.
- [Finviz Screener Copy All Symbols](scripts/finviz-screener-copy-symbols.user.js) — fetches every screener results page and copies its symbols.

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/).
2. Open a script above on GitHub.
3. Click **Raw** and confirm installation in Violentmonkey.

Scripts run only on matching StockCharts ACP or Finviz screener pages. Review source before installing.

## Development

Edit the `.user.js` files directly. Keep each script standalone and increment its `@version` when publishing an update.

Files under `exports/` are local Violentmonkey export metadata and are intentionally ignored by Git.
