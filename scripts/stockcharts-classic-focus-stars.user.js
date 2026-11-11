// ==UserScript==
// @name         StockCharts Classic Focus Stars
// @namespace    local.stockcharts.classic
// @version      1.0.4
// @description  Stage symbols and synchronize stars with a Focus ChartList.
// @match        https://stockcharts.com/panels*
// @match        https://www.stockcharts.com/panels*
// @match        https://stockcharts.com/sc3/ui*
// @match        https://www.stockcharts.com/sc3/ui*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const CONFIG_KEY = 'vm-stockcharts-classic-focus-config-v1';
    const PENDING_KEY = 'vm-stockcharts-classic-focus-pending-v1';
    const CACHE_KEY = 'vm-stockcharts-classic-focus-cache-v1';
    const LAST_STYLE_KEY = 'vm-stockcharts-classic-focus-last-style-v1';
    const SYNC_MAX_AGE_MS = 5 * 60 * 1000;

    function normalizeSymbol(value) {
        return String(value ?? '').trim().toUpperCase();
    }

    function parseFavoritesResource(value, origin = location.origin) {
        try {
            const url = new URL(value, origin);
            const pageUrl = new URL(origin);
            const stockChartsHosts = new Set([
                'stockcharts.com',
                'www.stockcharts.com',
            ]);

            if (
                !stockChartsHosts.has(url.hostname) ||
                !stockChartsHosts.has(pageUrl.hostname) ||
                url.pathname !== '/json/api' ||
                url.searchParams.get('cmd') !== 'get-favorites'
            ) {
                return null;
            }

            const chartCode = Number(url.searchParams.get('cc'));
            const listNum = Number(url.searchParams.get('ln'));

            if (
                !Number.isInteger(chartCode) || chartCode <= 0 ||
                !Number.isInteger(listNum) || listNum <= 0
            ) {
                return null;
            }

            return {
                apiOrigin: url.origin,
                chartCode,
                listNum,
                url: url.href,
            };
        } catch {
            return null;
        }
    }

    function parseStyleId(value) {
        const match = String(value ?? '').match(/[?&]id=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    }

    function groupFavorites(favorites) {
        const grouped = new Map();

        for (const favorite of Array.isArray(favorites) ? favorites : []) {
            const symbol = normalizeSymbol(favorite?.symbol);
            const recID = Number(favorite?.recID);

            if (!symbol || !Number.isInteger(recID) || recID <= 0) continue;

            const records = grouped.get(symbol) ?? [];
            records.push({ ...favorite, symbol, recID });
            grouped.set(symbol, records);
        }

        return grouped;
    }

    function reconcilePending(pending, focusBySymbol) {
        return new Set(
            [...pending].filter(symbol => !focusBySymbol.has(symbol))
        );
    }

    function buildDeleteRequests(chartCode, records) {
        return records.map(record => {
            const query = new URLSearchParams({
                cmd: 'delete-favorite',
                chartCode: String(chartCode),
                recID: String(record.recID),
                src: 'panels',
            });

            return `/json/api?${query}`;
        });
    }

    function getSymbolState(symbol, pending, focusBySymbol) {
        if (focusBySymbol.has(symbol)) return 'focus';
        if (pending.has(symbol)) return 'pending';
        return 'none';
    }

    function placeStar(target, button, placement) {
        if (placement.startsWith('after')) {
            target.insertAdjacentElement('afterend', button);
        } else {
            target.append(button);
        }
    }

    function loadJson(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) ?? fallback;
        } catch {
            return fallback;
        }
    }

    function saveJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getDiscoveredFocus() {
        const entries = performance.getEntriesByType('resource');

        for (let index = entries.length - 1; index >= 0; index -= 1) {
            const parsed = parseFavoritesResource(entries[index].name);
            if (parsed) return parsed;
        }

        return null;
    }

    function getPageStyleId() {
        const currentStyle = new URL(location.href).searchParams.get('id');
        if (currentStyle) return currentStyle;

        for (const anchor of document.querySelectorAll('a[href*="/sc3/ui/"]')) {
            try {
                const style = new URL(anchor.href).searchParams.get('id');
                if (style) return style;
            } catch {
                // Ignore malformed links from unrelated page content.
            }
        }

        return '';
    }

    function getLinkedSymbol(root) {
        const link = root?.querySelector(
            'a[href*="/sc3/ui/"][href*="s="]'
        );

        try {
            return normalizeSymbol(new URL(link.href).searchParams.get('s'));
        } catch {
            return '';
        }
    }

    function init() {
        let config = loadJson(CONFIG_KEY, null);
        let pending = new Set(
            loadJson(PENDING_KEY, []).map(normalizeSymbol).filter(Boolean)
        );
        let focusBySymbol = new Map();
        let lastStyle = loadJson(LAST_STYLE_KEY, '');
        let lastSync = 0;
        let syncError = '';
        let updateQueued = false;
        let syncing = false;
        const mutating = new Set();

        const cached = loadJson(CACHE_KEY, null);
        if (
            config &&
            cached?.chartCode === config.chartCode &&
            cached?.listNum === config.listNum
        ) {
            focusBySymbol = groupFavorites(cached.favorites);
            lastSync = Number(cached.syncedAt) || 0;
            pending = reconcilePending(pending, focusBySymbol);
        }

        function savePending() {
            saveJson(PENDING_KEY, [...pending]);
        }

        function applyFavorites(favorites) {
            focusBySymbol = groupFavorites(favorites);
            pending = reconcilePending(pending, focusBySymbol);
            lastSync = Date.now();
            syncError = '';
            savePending();
            saveJson(CACHE_KEY, {
                chartCode: config.chartCode,
                listNum: config.listNum,
                syncedAt: lastSync,
                favorites: [...focusBySymbol.values()].flat(),
            });
        }

        async function requestJson(url, options) {
            const response = await fetch(url, {
                credentials: 'include',
                ...options,
            });
            const data = await response.json();

            if (!response.ok || !data?.success) {
                throw new Error(data?.message || `HTTP ${response.status}`);
            }

            return data;
        }

        function getApiUrl() {
            return new URL(
                '/json/api',
                config.apiOrigin || 'https://stockcharts.com'
            );
        }

        function getFavoritesUrl() {
            const url = getApiUrl();
            url.search = new URLSearchParams({
                cmd: 'get-favorites',
                cc: String(config.chartCode),
                ln: String(config.listNum),
                src: 'panels',
            });
            return url;
        }

        async function syncFocus() {
            if (!config || syncing) return;
            syncing = true;
            render();

            try {
                const data = await requestJson(getFavoritesUrl());
                applyFavorites(data.favorites);
            } catch (error) {
                syncError = error.message;
                console.error('Could not synchronize Focus ChartList:', error);
            } finally {
                syncing = false;
                render();
            }
        }

        async function useCurrentList() {
            const discovered = getDiscoveredFocus();
            if (!discovered) return;

            try {
                const data = await requestJson(discovered.url);
                const style = parseStyleId(data.favorites?.[0]?.style) ||
                    getPageStyleId() ||
                    lastStyle;

                config = {
                    apiOrigin: discovered.apiOrigin,
                    chartCode: discovered.chartCode,
                    listNum: discovered.listNum,
                    style,
                };
                saveJson(CONFIG_KEY, config);
                applyFavorites(data.favorites);
            } catch (error) {
                syncError = error.message;
                console.error('Could not configure Focus ChartList:', error);
            }

            render();
        }

        async function addPendingToFocus() {
            if (!config?.style || !pending.size || syncing) return;

            const url = getApiUrl();
            url.search = new URLSearchParams({
                cmd: 'add-favorites-bulk',
                cc: String(config.chartCode),
                listNum: String(config.listNum),
                style: config.style,
                src: 'panels',
            });

            syncing = true;
            render();

            try {
                await requestJson(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                    body: JSON.stringify({ symbols: [...pending].join(',') }),
                });
            } catch (error) {
                syncError = error.message;
                console.error('Could not add symbols to Focus ChartList:', error);
                syncing = false;
                render();
                return;
            }

            syncing = false;
            await syncFocus();
        }

        async function removeFromFocus(symbol) {
            const records = focusBySymbol.get(symbol) ?? [];
            if (!config || !records.length || mutating.has(symbol)) return;

            if (!confirm(
                `Remove ${symbol} from Focus ChartList?` +
                (records.length > 1 ? ` This deletes ${records.length} charts.` : '')
            )) {
                return;
            }

            const url = getApiUrl();
            url.search = new URLSearchParams({
                cmd: 'batch',
                stopOnSingleFailure: 'false',
                src: 'panels',
            });
            mutating.add(symbol);
            render();

            try {
                const data = await requestJson(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requests: buildDeleteRequests(
                            config.chartCode,
                            records
                        ),
                    }),
                });
                if (!Array.isArray(data.responses)) {
                    throw new Error('Delete response did not include results');
                }

                const failures = data.responses.filter(item => !item.success);

                if (failures.length) {
                    throw new Error(
                        `${failures.length} Focus chart deletion(s) failed`
                    );
                }
            } catch (error) {
                syncError = error.message;
                console.error(`Could not remove ${symbol} from Focus:`, error);
            } finally {
                mutating.delete(symbol);
                await syncFocus();
            }
        }

        function toggleSymbol(symbol) {
            if (focusBySymbol.has(symbol)) {
                removeFromFocus(symbol);
                return;
            }

            if (pending.has(symbol)) {
                pending.delete(symbol);
            } else {
                pending.add(symbol);
            }

            savePending();
            render();
        }

        async function copyPending(button) {
            const text = [...pending].join('\n');
            if (!text) return;

            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.cssText = 'position:fixed;opacity:0';
                    document.body.append(textarea);
                    textarea.select();
                    if (!document.execCommand('copy')) {
                        throw new Error('Clipboard API unavailable');
                    }
                    textarea.remove();
                }

                flashButton(button, `Copied ${pending.size}`);
            } catch (error) {
                console.error('Could not copy pending symbols:', error);
                flashButton(button, 'Copy failed');
            }
        }

        function flashButton(button, message) {
            const original = button.textContent;
            button.textContent = message;
            setTimeout(() => {
                button.textContent = original;
            }, 1200);
        }

        function createButton(id, label, handler) {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = id;
            button.textContent = label;
            button.addEventListener('click', () => handler(button));
            return button;
        }

        function createToolbar() {
            if (document.querySelector('#vm-focus-toolbar')) return;

            const toolbar = document.createElement('div');
            toolbar.id = 'vm-focus-toolbar';

            const status = document.createElement('span');
            status.id = 'vm-focus-status';

            toolbar.append(
                status,
                createButton('vm-focus-copy', 'Copy', copyPending),
                createButton('vm-focus-add', 'Add to Focus', addPendingToFocus),
                createButton('vm-focus-clear', 'Clear', () => {
                    if (pending.size && confirm(
                        `Clear ${pending.size} pending symbol(s)?`
                    )) {
                        pending.clear();
                        savePending();
                        render();
                    }
                }),
                createButton('vm-focus-sync', 'Sync', syncFocus),
                createButton('vm-focus-use-list', 'Use current list', useCurrentList)
            );
            document.body.append(toolbar);
        }

        function updateToolbar() {
            const discovered = getDiscoveredFocus();
            const status = document.querySelector('#vm-focus-status');
            const copy = document.querySelector('#vm-focus-copy');
            const add = document.querySelector('#vm-focus-add');
            const clear = document.querySelector('#vm-focus-clear');
            const sync = document.querySelector('#vm-focus-sync');
            const useList = document.querySelector('#vm-focus-use-list');

            setText(status, !config
                ? `● ${pending.size} pending · Focus not configured`
                : !config.style
                    ? `● ${pending.size} pending · Focus #${config.listNum} · ` +
                        'open a populated list'
                    : `● ${pending.size} pending · ` +
                        `● ${focusBySymbol.size} focus`);
            status.title = syncError
                ? `Last sync failed: ${syncError}`
                : lastSync
                    ? `Last synced ${new Date(lastSync).toLocaleString()}`
                    : 'Not synchronized';
            status.classList.toggle('vm-sync-error', Boolean(syncError));
            copy.disabled = pending.size === 0;
            add.disabled = !config?.style || pending.size === 0 || syncing;
            add.title = config?.style
                ? 'Add pending symbols to Focus ChartList'
                : config
                    ? 'Open any populated ChartList once to discover ChartStyle'
                    : 'Open Focus ChartList, then click Use list';
            clear.disabled = pending.size === 0;
            sync.disabled = !config || syncing;
            setText(sync, syncing ? 'Syncing…' : 'Sync');
            useList.disabled = !discovered || syncing;
            useList.title = discovered
                ? `Configure ChartList #${discovered.listNum} as Focus`
                : 'Open the Focus ChartList and reload this page';
            setText(useList, discovered
                ? `Use list #${discovered.listNum}`
                : config
                    ? `Focus #${config.listNum}`
                    : 'Open Focus list');
        }

        function setText(element, value) {
            if (element.textContent !== value) element.textContent = value;
        }

        function updateStar(button, symbol) {
            const state = getSymbolState(symbol, pending, focusBySymbol);
            const busy = mutating.has(symbol);
            const glyph = state === 'none' ? '☆' : '★';
            const title = state === 'focus'
                ? `Remove ${symbol} from Focus ChartList`
                : state === 'pending'
                    ? `Remove ${symbol} from pending symbols`
                    : `Stage ${symbol} for Focus ChartList`;

            if (button.classList.contains('vm-focus-star-css-glyph')) {
                if (button.textContent) button.textContent = '';
            } else if (button.textContent !== glyph) {
                button.textContent = glyph;
            }
            button.dataset.symbol = symbol;
            button.dataset.state = state;
            button.title = title;
            button.disabled = busy;
            button.setAttribute('aria-label', title);
            button.setAttribute('aria-pressed', String(state !== 'none'));
        }

        function addStar(target, symbol, placement = 'inside') {
            if (!target || !symbol) return;

            const outside = placement.startsWith('after');
            let button = outside
                ? target.nextElementSibling
                : target.querySelector(':scope > .vm-focus-star');

            if (!button?.classList.contains('vm-focus-star')) {
                button = null;
            }

            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'vm-focus-star';
                if (placement === 'overlay') {
                    target.classList.add('vm-focus-star-container');
                }

                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleSymbol(button.dataset.symbol);
                });

                placeStar(target, button, placement);
            }

            button.classList.toggle(
                'vm-focus-star-overlay',
                placement === 'overlay'
            );
            button.classList.toggle(
                'vm-focus-star-css-glyph',
                placement.endsWith('-css')
            );
            updateStar(button, symbol);
        }

        function decorate() {
            for (const element of document.querySelectorAll('.candle-chart')) {
                const symbol = getLinkedSymbol(element.closest('tr')) ||
                    normalizeSymbol(element.firstChild?.textContent);
                addStar(element, symbol, 'after');
            }

            for (const chart of document.querySelectorAll('.cgchart')) {
                const symbol = normalizeSymbol(
                    chart.querySelector('[data-symbol]')?.dataset.symbol
                );
                addStar(chart, symbol, 'overlay');
            }

            for (const panel of document.querySelectorAll('.chartpanel')) {
                addStar(
                    panel.querySelector('.chart-title'),
                    getLinkedSymbol(panel)
                );
            }

            for (const cell of document.querySelectorAll(
                '#scc-favorites-edittable tbody td.symbol'
            )) {
                const link = cell.querySelector(
                    'a[href*="/sc3/ui/"][href*="s="]'
                );
                addStar(link, getLinkedSymbol(cell), 'after-css');
            }

            const editorSymbol = normalizeSymbol(
                new URL(location.href).searchParams.get('s')
            );
            const symbolInput = document.querySelector('#symbol-input');
            if (editorSymbol && symbolInput) {
                const target = symbolInput.parentElement;
                addStar(target, editorSymbol);
            }

            for (const button of document.querySelectorAll('.vm-focus-star')) {
                updateStar(button, button.dataset.symbol);
            }
        }

        function render() {
            const pageStyle = getPageStyleId();
            if (pageStyle && pageStyle !== lastStyle) {
                lastStyle = pageStyle;
                saveJson(LAST_STYLE_KEY, lastStyle);
            }
            if (config && !config.style && lastStyle) {
                config = { ...config, style: lastStyle };
                saveJson(CONFIG_KEY, config);
            }

            createToolbar();
            decorate();
            updateToolbar();
        }

        function scheduleRender() {
            if (updateQueued) return;
            updateQueued = true;
            requestAnimationFrame(() => {
                updateQueued = false;
                render();
            });
        }

        const style = document.createElement('style');
        style.textContent = `
            .vm-focus-star {
                margin-left: 5px;
                padding: 0 2px;
                border: 0;
                background: transparent;
                color: #111;
                font: 18px/1 Arial, sans-serif;
                cursor: pointer;
                vertical-align: middle;
            }

            .vm-focus-star[data-state="focus"] { color: #188038; }
            .vm-focus-star:disabled { cursor: wait; opacity: 0.55; }
            .vm-focus-star-css-glyph::before { content: "☆"; }
            .vm-focus-star-css-glyph:not([data-state="none"])::before {
                content: "★";
            }

            .vm-focus-star-container { position: relative; }
            .vm-focus-star-overlay {
                position: absolute;
                top: 3px;
                left: 3px;
                z-index: 3;
                margin: 0;
                border-radius: 3px;
                background: rgba(255, 255, 255, 0.88);
            }

            #vm-focus-toolbar {
                position: fixed;
                left: 8px;
                bottom: 8px;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 6px 8px;
                border: 1px solid #777;
                border-radius: 4px;
                background: rgba(255, 255, 255, 0.96);
                color: #111;
                box-shadow: 0 2px 8px #0005;
                font: 12px Arial, sans-serif;
            }

            #vm-focus-toolbar button {
                padding: 3px 7px;
                border: 1px solid #777;
                border-radius: 3px;
                background: #f5f5f5;
                color: #111;
                cursor: pointer;
            }

            #vm-focus-toolbar button:disabled {
                cursor: default;
                opacity: 0.45;
            }

            #vm-focus-status::first-letter { color: #111; }
            #vm-focus-status.vm-sync-error { color: #b3261e; }
        `;
        document.head.append(style);

        new MutationObserver(scheduleRender).observe(document.body, {
            childList: true,
            subtree: true,
        });

        window.addEventListener('storage', event => {
            if (![
                CONFIG_KEY,
                PENDING_KEY,
                CACHE_KEY,
                LAST_STYLE_KEY,
            ].includes(event.key)) return;
            config = loadJson(CONFIG_KEY, null);
            lastStyle = loadJson(LAST_STYLE_KEY, '');
            pending = new Set(
                loadJson(PENDING_KEY, []).map(normalizeSymbol).filter(Boolean)
            );
            const nextCache = loadJson(CACHE_KEY, null);
            const cacheMatches = config &&
                nextCache?.chartCode === config.chartCode &&
                nextCache?.listNum === config.listNum;
            focusBySymbol = groupFavorites(
                cacheMatches ? nextCache.favorites : []
            );
            pending = reconcilePending(pending, focusBySymbol);
            savePending();
            lastSync = cacheMatches ? Number(nextCache.syncedAt) || 0 : 0;
            render();
        });

        document.addEventListener('visibilitychange', () => {
            if (
                document.visibilityState === 'visible' &&
                config &&
                Date.now() - lastSync > SYNC_MAX_AGE_MS
            ) {
                syncFocus();
            }
        });

        render();
        if (config) syncFocus();
    }

    if (typeof module === 'object') {
        module.exports = {
            buildDeleteRequests,
            getSymbolState,
            groupFavorites,
            normalizeSymbol,
            parseFavoritesResource,
            parseStyleId,
            placeStar,
            reconcilePending,
        };
    } else {
        init();
    }
})();
