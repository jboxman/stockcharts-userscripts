// ==UserScript==
// @name         StockCharts ACP Starred Symbols
// @namespace    local.stockcharts.acp
// @version      1.0.0
// @description  Star ChartList symbols and copy them into a new ChartList.
// @match        https://stockcharts.com/acp*
// @match        https://www.stockcharts.com/acp*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const STORAGE_KEY = 'vm-stockcharts-starred-symbols-v1';

    const ROW_SELECTOR = [
        '.acp-chart-list-item[data-symbol]',
        '.sharp-charts-chart-list-item[data-symbol]',
    ].join(',');

    let starred = loadStarred();
    let updateQueued = false;

    function normalizeSymbol(value) {
        return String(value ?? '').trim().toUpperCase();
    }

    function loadStarred() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

            return new Set(
                Array.isArray(saved)
                    ? saved.map(normalizeSymbol).filter(Boolean)
                    : []
            );
        } catch {
            return new Set();
        }
    }

    function saveStarred() {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([...starred])
        );
    }

    function toggleSymbol(symbol) {
        if (starred.has(symbol)) {
            starred.delete(symbol);
        } else {
            starred.add(symbol);
        }

        saveStarred();
        render();
    }

    function updateStarButton(button) {
        const symbol = button.dataset.symbol;
        const active = starred.has(symbol);
        const glyph = active ? '★' : '☆';
        const title = active
        ? `Remove ${symbol} from starred symbols`
        : `Add ${symbol} to starred symbols`;

        if (button.textContent !== glyph) {
            button.textContent = glyph;
        }

        if (button.title !== title) {
            button.title = title;
        }

        button.classList.toggle('vm-star-active', active);
        button.setAttribute('aria-pressed', String(active));
    }

    function decorateRows() {
        for (const row of document.querySelectorAll(ROW_SELECTOR)) {
            const symbol = normalizeSymbol(row.dataset.symbol);
            if (!symbol) continue;

            let button = row.querySelector(':scope .vm-favorite-star');

            if (!button) {
                const symbolElement =
                    row.querySelector(
                        '[data-acp-sidebar-chart-list-symbol]'
                    ) ??
                    row.querySelector(
                        '[data-sharpcharts-sidebar-chart-list-symbol]'
                    ) ??
                    row.querySelector('.symbol');

                if (!symbolElement) continue;

                button = document.createElement('button');
                button.type = 'button';
                button.className = 'vm-favorite-star';

                button.addEventListener('mousedown', event => {
                    event.stopPropagation();
                });

                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();

                    toggleSymbol(button.dataset.symbol);
                });

                symbolElement.append(button);
            }

            button.dataset.symbol = symbol;
            updateStarButton(button);
        }
    }

    function getHeaderSymbol(header) {
        const panel = header.closest('.acp-grid-panel');

        // ChartIQ keeps exact symbol here, even though element is hidden.
        const chartTitle = panel
        ?.querySelector('.stx-panel-title.chart-title')
        ?.textContent
        ?.trim();

        if (chartTitle) {
            return normalizeSymbol(chartTitle);
        }

        // Fallback: "HIMS - Hims & Hers Health, Inc." → "HIMS"
        const headerText =
              header.getAttribute('title') ||
              header.textContent ||
              '';

        return normalizeSymbol(
            headerText.split(/\s+-\s+/)[0]
        );
    }

    function decorateHeaders() {
        const headers = document.querySelectorAll(
            '.acp-grid-panel .chart-info .ticker-symbol'
        );

        for (const header of headers) {
            const symbol = getHeaderSymbol(header);
            if (!symbol) continue;

            let button = header.nextElementSibling;

            if (
                !button?.classList.contains('vm-header-star')
            ) {
                button = document.createElement('button');
                button.type = 'button';
                button.className =
                    'vm-favorite-star vm-header-star';

                button.addEventListener('mousedown', event => {
                    event.stopPropagation();
                });

                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();

                    toggleSymbol(button.dataset.symbol);
                });

                header.insertAdjacentElement('afterend', button);
            }

            button.dataset.symbol = symbol;
            updateStarButton(button);
        }
    }

    function createToolbar() {
        if (document.querySelector('#vm-starred-toolbar')) return;

        const toolbar = document.createElement('div');
        toolbar.id = 'vm-starred-toolbar';

        const count = document.createElement('span');
        count.id = 'vm-starred-count';

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.id = 'vm-copy-starred';
        copyButton.textContent = 'Copy';

        copyButton.addEventListener('click', async () => {
            const symbols = [...starred];

            if (!symbols.length) {
                flashButton(copyButton, 'None starred');
                return;
            }

            try {
                await copyText(symbols.join('\n'));
                flashButton(copyButton, `Copied ${symbols.length}`);
            } catch (error) {
                console.error('Could not copy starred symbols:', error);
                flashButton(copyButton, 'Copy failed');
            }
        });

        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.id = 'vm-clear-starred';
        clearButton.textContent = 'Clear';

        clearButton.addEventListener('click', () => {
            if (
                starred.size &&
                confirm(`Remove all ${starred.size} starred symbols?`)
            ) {
                starred.clear();
                saveStarred();
                render();
            }
        });

        toolbar.append(count, copyButton, clearButton);
        document.body.append(toolbar);
    }

    function updateToolbar() {
        const count = document.querySelector('#vm-starred-count');
        const copyButton = document.querySelector('#vm-copy-starred');
        const clearButton = document.querySelector('#vm-clear-starred');

        if (count) {
            count.textContent = `★ ${starred.size}`;
            count.title = [...starred].join(', ') || 'No starred symbols';
        }

        if (copyButton) copyButton.disabled = starred.size === 0;
        if (clearButton) clearButton.disabled = starred.size === 0;
    }

    async function copyText(text) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';

        document.body.append(textarea);
        textarea.select();

        const copied = document.execCommand('copy');
        textarea.remove();

        if (!copied) {
            throw new Error('Clipboard API unavailable');
        }
    }

    function flashButton(button, message) {
        const original = button.textContent;
        button.textContent = message;

        setTimeout(() => {
            button.textContent = original;
        }, 1200);
    }

    function render() {
        createToolbar();
        decorateRows();
        decorateHeaders();

        for (
            const button of document.querySelectorAll(
                '.vm-favorite-star'
            )
        ) {
            updateStarButton(button);
        }

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
        .vm-favorite-star {
            margin-left: 5px;
            padding: 0 2px;
            border: 0;
            background: transparent;
            color: #8d99a5;
            font: inherit;
            font-size: 16px;
            line-height: 1;
            cursor: pointer;
            vertical-align: middle;
        }

        .vm-favorite-star:hover,
        .vm-favorite-star.vm-star-active {
            color: #f4b400;
        }

        #vm-starred-toolbar {
            position: fixed;
            left: 8px;
            bottom: 8px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 6px 8px;
            border: 1px solid #5a6672;
            border-radius: 4px;
            background: rgba(45, 51, 57, 0.94);
            color: white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
            font: 12px Arial, sans-serif;
        }

        #vm-starred-toolbar button {
            padding: 3px 7px;
            border: 1px solid #707f8f;
            border-radius: 3px;
            background: #434c56;
            color: white;
            cursor: pointer;
        }

        #vm-starred-toolbar button:hover:not(:disabled) {
            background: #5a6672;
        }

        #vm-starred-toolbar button:disabled {
            opacity: 0.45;
            cursor: default;
        }

        #vm-starred-count {
            min-width: 30px;
            color: #f4b400;
            font-weight: bold;
        }

        .vm-header-star {
             margin-left: 7px;
             font-size: 18px;
             vertical-align: middle;
        }
`;
    document.head.append(style);

    new MutationObserver(scheduleRender).observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true,
    });

    window.addEventListener('storage', event => {
        if (event.key === STORAGE_KEY) {
            starred = loadStarred();
            render();
        }
    });

    render();
})();