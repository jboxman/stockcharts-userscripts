// ==UserScript==
// @name         StockCharts Classic Chart Styles
// @namespace    local.stockcharts.classic
// @version      1.0.1
// @description  Switch displayed SharpCharts between saved chart styles.
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

    const STYLES = [
        {
            label: 'Daily + SPX',
            id: 'p24166688785',
            parameters: { p: 'D', b: '5', g: '2' },
        },
        {
            label: 'Weekly + SPX',
            id: 'p92783674841',
            parameters: { p: 'W', b: '5', g: '2' },
        },
    ];
    const STORAGE_KEY = 'vm-stockcharts-classic-chart-style-v1';
    const IMAGE_SELECTOR = [
        'img[src*="/c-sc/sc?"]',
        'img[data-src*="/c-sc/sc?"]',
    ].join(',');

    function rewriteStyleUrl(
        value,
        chartStyle,
        cacheBust = Date.now(),
        origin = 'https://stockcharts.com'
    ) {
        try {
            const url = new URL(value, origin);
            if (url.pathname !== '/c-sc/sc') return value;

            const key = url.searchParams.has('i') ? 'i' : 'id';
            const otherKey = key === 'i' ? 'id' : 'i';
            if (
                url.searchParams.get(key) === chartStyle.id &&
                !url.searchParams.has(otherKey) &&
                Object.entries(chartStyle.parameters).every(
                    ([name, parameter]) =>
                        url.searchParams.get(name) === parameter
                )
            ) {
                return value;
            }

            url.searchParams.set(key, chartStyle.id);
            url.searchParams.delete(otherKey);
            for (const [name, parameter] of Object.entries(
                chartStyle.parameters
            )) {
                url.searchParams.set(name, parameter);
            }
            url.searchParams.set('r', String(cacheBust));
            return url.href;
        } catch {
            return value;
        }
    }

    function init() {
        let selectedStyle = localStorage.getItem(STORAGE_KEY) || '';
        let updateQueued = false;

        if (!STYLES.some(style => style.id === selectedStyle)) {
            selectedStyle = '';
        }

        function applyStyleToImage(image, chartStyle) {
            for (const attribute of ['src', 'data-src']) {
                const current = image.getAttribute(attribute);
                if (!current) continue;

                const next = rewriteStyleUrl(
                    current,
                    chartStyle,
                    Date.now(),
                    location.origin
                );
                if (next !== current) image.setAttribute(attribute, next);
            }
        }

        function createToolbar() {
            if (document.querySelector('#vm-chart-style-toolbar')) return;

            const toolbar = document.createElement('div');
            toolbar.id = 'vm-chart-style-toolbar';
            toolbar.setAttribute('aria-label', 'Chart style');

            for (const chartStyle of STYLES) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = chartStyle.label;
                button.dataset.styleId = chartStyle.id;
                button.addEventListener('click', () => {
                    selectedStyle = chartStyle.id;
                    localStorage.setItem(STORAGE_KEY, selectedStyle);
                    render();
                });
                toolbar.append(button);
            }

            document.body.append(toolbar);
        }

        function updateToolbar() {
            for (const button of document.querySelectorAll(
                '#vm-chart-style-toolbar button'
            )) {
                const active = button.dataset.styleId === selectedStyle;
                button.classList.toggle('vm-active', active);
                button.setAttribute('aria-pressed', String(active));
            }
        }

        function render() {
            createToolbar();
            updateToolbar();

            if (!selectedStyle) return;
            const chartStyle = STYLES.find(
                style => style.id === selectedStyle
            );
            for (const image of document.querySelectorAll(IMAGE_SELECTOR)) {
                applyStyleToImage(image, chartStyle);
            }
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
            #vm-chart-style-toolbar {
                position: fixed;
                right: 8px;
                bottom: 8px;
                z-index: 10000;
                display: flex;
                gap: 5px;
                padding: 6px 8px;
                border: 1px solid #777;
                border-radius: 4px;
                background: rgba(255, 255, 255, 0.96);
                box-shadow: 0 2px 8px #0005;
                font: 12px Arial, sans-serif;
            }

            #vm-chart-style-toolbar button {
                padding: 3px 7px;
                border: 1px solid #777;
                border-radius: 3px;
                background: #f5f5f5;
                color: #111;
                cursor: pointer;
            }

            #vm-chart-style-toolbar button.vm-active {
                border-color: #1769aa;
                background: #1769aa;
                color: #fff;
            }
        `;
        document.head.append(style);

        new MutationObserver(scheduleRender).observe(document.body, {
            attributes: true,
            attributeFilter: ['src', 'data-src'],
            childList: true,
            subtree: true,
        });

        window.addEventListener('storage', event => {
            if (event.key !== STORAGE_KEY) return;
            selectedStyle = STYLES.some(style => style.id === event.newValue)
                ? event.newValue
                : '';
            render();
        });

        render();
    }

    if (typeof module === 'object') {
        module.exports = { rewriteStyleUrl };
    } else {
        init();
    }
})();
