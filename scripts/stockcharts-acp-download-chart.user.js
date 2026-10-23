// ==UserScript==
// @name         StockCharts ACP Download Chart Shortcut
// @namespace    local.stockcharts.acp
// @version      1.1.0
// @description  Download the current ACP chart layout with a useful filename.
// @match        https://stockcharts.com/acp*
// @match        https://www.stockcharts.com/acp*
// @grant        none
// @inject-into  page
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const DOWNLOAD_LABEL = 'Download Chart as PNG';
    const DOWNLOAD_TIMEOUT_MS = 30_000;
    const editableSelector = [
        'input',
        'textarea',
        'select',
        '[contenteditable]:not([contenteditable="false"])',
        '[role="textbox"]',
        '[role="searchbox"]',
        '[role="combobox"]',
        '[role="spinbutton"]',
    ].join(',');
    let appliedLayoutName = '';
    let pendingFilename = '';
    let pendingFilenameTimer;

    function sanitizeFilenamePart(value) {
        return String(value ?? '')
            .normalize('NFKC')
            .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[. ]+$/g, '')
            .slice(0, 80);
    }

    function formatTimestamp(date) {
        const pad = value => String(value).padStart(2, '0');

        return [
            date.getFullYear(),
            pad(date.getMonth() + 1),
            pad(date.getDate()),
        ].join('-') + '_' + [
            pad(date.getHours()),
            pad(date.getMinutes()),
            pad(date.getSeconds()),
        ].join('');
    }

    function getSymbols(root = document) {
        return [...new Set(
            [...root.querySelectorAll(
                '.acp-grid-panel .stx-panel-title.chart-title'
            )]
                .map(element => element.textContent.trim())
                .filter(Boolean)
        )];
    }

    function buildFilename({ layoutName, symbols, date = new Date() }) {
        const context = [
            sanitizeFilenamePart(layoutName),
            sanitizeFilenamePart(symbols.join('-')),
        ].filter(Boolean).join('--') || 'StockCharts-ACP';

        return `${context}--${formatTimestamp(date)}.png`;
    }

    function renamePngDownload(anchor, filename) {
        if (
            !filename ||
            !anchor.download?.toLowerCase().endsWith('.png') ||
            !anchor.href?.startsWith('data:image/')
        ) {
            return false;
        }

        anchor.download = filename;
        return true;
    }

    function armFilenameOverride(filename) {
        pendingFilename = filename;
        clearTimeout(pendingFilenameTimer);
        pendingFilenameTimer = setTimeout(() => {
            pendingFilename = '';
        }, DOWNLOAD_TIMEOUT_MS);
    }

    function installFilenameOverride() {
        const nativeClick = HTMLAnchorElement.prototype.click;

        HTMLAnchorElement.prototype.click = function(...args) {
            if (renamePngDownload(this, pendingFilename)) {
                pendingFilename = '';
                clearTimeout(pendingFilenameTimer);
            }

            return nativeClick.apply(this, args);
        };
    }

    function isCaptureShortcut(event) {
        return (
            event.code === 'KeyC' &&
            event.altKey &&
            event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey
        );
    }

    function isEditing(event) {
        const elements = [
            ...(event.composedPath?.() ?? [event.target]),
            document.activeElement,
        ];

        return elements.some(element =>
            element instanceof Element &&
            (element.matches(editableSelector) ||
             element.closest(editableSelector) ||
             element.isContentEditable)
        );
    }

    function findDownloadAction(root = document) {
        const actions = [...root.querySelectorAll('a')];

        return actions.find(action =>
            action.getAttribute('click.delegate') ===
                'handleDownloadChart($event)'
        ) ?? actions.find(action =>
            action.textContent.replace(/\s+/g, ' ').trim() === DOWNLOAD_LABEL
        ) ?? null;
    }

    function handleKeydown(event) {
        if (
            !isCaptureShortcut(event) ||
            event.defaultPrevented ||
            event.repeat ||
            event.isComposing ||
            isEditing(event)
        ) {
            return;
        }

        const action = findDownloadAction();
        if (!action) {
            console.warn(`StockCharts shortcut: "${DOWNLOAD_LABEL}" not found.`);
            return;
        }

        event.preventDefault();
        armFilenameOverride(buildFilename({
            layoutName: appliedLayoutName,
            symbols: getSymbols(),
        }));
        action.click();
    }

    function trackAppliedLayout(event) {
        const layout = event.target instanceof Element &&
            event.target.closest('[title="Apply Layout"]');

        if (layout) {
            appliedLayoutName = layout.textContent.replace(/\s+/g, ' ').trim();
        }
    }

    if (typeof document !== 'undefined') {
        installFilenameOverride();
        document.addEventListener('click', trackAppliedLayout, true);
        document.addEventListener('keydown', handleKeydown);
    }

    if (typeof module !== 'undefined') {
        module.exports = {
            buildFilename,
            findDownloadAction,
            isCaptureShortcut,
            renamePngDownload,
            sanitizeFilenamePart,
        };
    }
})();
