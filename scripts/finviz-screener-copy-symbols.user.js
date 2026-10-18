// ==UserScript==
// @name         Finviz Screener Copy All Symbols
// @namespace    local.finviz.screener
// @version      1.1.0
// @description  Fetch every Finviz screener results page and copy its symbols.
// @match        https://finviz.com/screener*
// @match        https://www.finviz.com/screener*
// @grant        GM_setClipboard
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const BUTTON_ID = 'vm-copy-all-finviz-symbols';
    const PAGE_DELAY_MS = 300;
    const PAGE_SIZE = 20;

    function getApiUrl(firstRow) {
        const filters = new URL(location.href).searchParams.get('f');
        if (!filters) throw new Error('Finviz filters not found in URL');

        const url = new URL('/api/screener-data', location.origin);
        url.searchParams.set('columns', 'ticker');
        url.searchParams.set('firstRow', String(firstRow));
        url.searchParams.set('pageSize', String(PAGE_SIZE));
        url.searchParams.set('type', 'stocks');
        url.searchParams.set('filters', filters);

        return url;
    }

    function delay(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    async function loadSymbols(button) {
        const symbols = new Set();
        let firstRow = 0;
        let totalCount;

        while (totalCount === undefined || firstRow < totalCount) {
            button.textContent = totalCount === undefined
                ? 'Loading symbols'
                : `Loading ${firstRow + 1}/${totalCount}`;

            if (firstRow) await delay(PAGE_DELAY_MS);

            const response = await fetch(getApiUrl(firstRow), {
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(`Finviz API returned ${response.status}`);
            }

            const data = await response.json();
            if (!Array.isArray(data.rows) || !Number.isFinite(data.totalCount)) {
                throw new Error('Unexpected Finviz API response');
            }

            totalCount = data.totalCount;

            for (const row of data.rows) {
                const symbol = String(row.ticker ?? '').trim().toUpperCase();
                if (symbol) symbols.add(symbol);
            }

            if (!data.rows.length && firstRow < totalCount) {
                throw new Error(`Finviz API stopped at row ${firstRow}`);
            }

            firstRow += data.rows.length;
        }

        GM_setClipboard([...symbols].join('\n'), 'text');
        return symbols.size;
    }

    function createButton() {
        if (document.querySelector(`#${BUTTON_ID}`)) return;

        const button = document.createElement('button');
        button.id = BUTTON_ID;
        button.type = 'button';
        button.textContent = 'Copy all symbols';
        button.style.cssText = [
            'position:fixed',
            'right:18px',
            'bottom:18px',
            'z-index:10000',
            'padding:9px 13px',
            'border:1px solid #777',
            'border-radius:5px',
            'background:#fff',
            'color:#111',
            'font:600 13px Arial,sans-serif',
            'box-shadow:0 2px 8px #0004',
            'cursor:pointer',
        ].join(';');

        button.addEventListener('click', async () => {
            button.disabled = true;

            try {
                const count = await loadSymbols(button);
                button.textContent = `Copied ${count} symbols`;
            } catch (error) {
                console.error('Could not copy Finviz symbols:', error);
                button.textContent = 'Copy failed — see console';
            } finally {
                setTimeout(() => {
                    button.disabled = false;
                    button.textContent = 'Copy all symbols';
                }, 2000);
            }
        });

        document.body.append(button);
    }

    if (
        typeof process === 'object' &&
        process.release?.name === 'node' &&
        typeof module === 'object'
    ) {
        module.exports = { getApiUrl, loadSymbols };
    } else {
        createButton();
    }
})();
