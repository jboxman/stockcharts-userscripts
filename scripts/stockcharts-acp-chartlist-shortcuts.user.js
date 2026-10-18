// ==UserScript==
// @name         StockCharts ACP ChartList Shortcuts
// @namespace    local.stockcharts.acp
// @version      1.0.0
// @description  Navigate ChartLists with [ and ].
// @match        https://stockcharts.com/acp*
// @match        https://www.stockcharts.com/acp*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const controls = {
        BracketLeft: {
            title: 'Load Previous Chart',
            delegate: 'loadPrevChart()',
            icon: '.fa-angle-double-left',
        },
        BracketRight: {
            title: 'Load Next Chart',
            delegate: 'loadNextChart()',
            icon: '.fa-angle-double-right',
        },
    };

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

    function isEnabled(button) {
        return (
            button.isConnected &&
            !button.disabled &&
            button.getAttribute('aria-disabled') !== 'true'
        );
    }

    function isVisible(button) {
        const style = getComputedStyle(button);

        return (
            button.getClientRects().length > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
        );
    }

    function findControl(control) {
        const candidates = [...document.querySelectorAll('button')]
            .filter(button =>
                button.title === control.title ||
                button.getAttribute('click.delegate') === control.delegate ||
                button.querySelector(control.icon)
            )
            .filter(isEnabled);

        // Prefer currently displayed control, but permit bound drawer control
        // when StockCharts keeps it mounted while drawer is hidden.
        return candidates.find(isVisible) ?? candidates[0] ?? null;
    }

    function handleKeydown(event) {
        const control = controls[event.code];

        if (
            !control ||
            event.defaultPrevented ||
            event.repeat ||
            event.isComposing ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            event.shiftKey ||
            isEditing(event)
        ) {
            return;
        }

        const button = findControl(control);
        if (!button) {
            console.warn(`StockCharts shortcut: "${control.title}" not found.`);
            return;
        }

        event.preventDefault();
        button.click();
    }

    document.addEventListener('keydown', handleKeydown);
})();