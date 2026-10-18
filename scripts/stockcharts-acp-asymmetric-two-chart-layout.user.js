// ==UserScript==
// @name         StockCharts ACP Asymmetric Two-Chart Layout
// @namespace    local.stockcharts.acp
// @version      1.0.0
// @description  Make horizontal two-chart layouts 1/3 left and 2/3 right.
// @match        https://stockcharts.com/acp*
// @match        https://www.stockcharts.com/acp*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const LEFT_PERCENT = 33.3333;
    const RIGHT_PERCENT = 100 - LEFT_PERCENT;

    const style = document.createElement('style');
    style.textContent = `
        #acpGridPanelWrapperId.vm-asymmetric-layout
            > .acp-grid-panel.vm-left-panel {
            left: 0 !important;
            width: ${LEFT_PERCENT}% !important;
        }

        #acpGridPanelWrapperId.vm-asymmetric-layout
            > .acp-grid-panel.vm-right-panel {
            left: ${LEFT_PERCENT}% !important;
            width: ${RIGHT_PERCENT}% !important;
        }
    `;
    document.head.append(style);

    let resizeTimer;
    let resizeEndTimer;
    let updateQueued = false;

    function notifyCharts() {
        clearTimeout(resizeTimer);
        clearTimeout(resizeEndTimer);

        // Immediate repaint.
        resizeTimer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 50);

        // ACP has a 0.5-second panel transition. Repaint again afterward.
        resizeEndTimer = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 600);
    }

    function removeOverride(wrapper, panels) {
        const changed = wrapper?.classList.contains('vm-asymmetric-layout');

        wrapper?.classList.remove('vm-asymmetric-layout');

        for (const panel of panels) {
            panel.classList.remove('vm-left-panel', 'vm-right-panel');
        }

        if (changed) {
            notifyCharts();
        }
    }

    function applyOverride() {
        const wrapper = document.querySelector('#acpGridPanelWrapperId');
        if (!wrapper) return;

        const panels = [
            ...wrapper.querySelectorAll(':scope > .acp-grid-panel'),
        ];

        /*
         * Only touch StockCharts' two-up horizontal layout:
         *
         * panel 1: top 0, left 0,  width 50%, height 100%
         * panel 2: top 0, left 50%, width 50%, height 100%
         *
         * Reading element.style sees ACP's original inline layout, unaffected
         * by our stylesheet override.
         */
        const isHorizontalTwoUp =
            panels.length === 2 &&
            panels.every(panel =>
                parseFloat(panel.style.top || '0') === 0 &&
                parseFloat(panel.style.height) === 100
            ) &&
            parseFloat(panels[0].style.left || '0') === 0 &&
            parseFloat(panels[0].style.width) === 50 &&
            parseFloat(panels[1].style.left) === 50 &&
            parseFloat(panels[1].style.width) === 50;

        if (!isHorizontalTwoUp) {
            removeOverride(wrapper, panels);
            return;
        }

        const wasApplied = wrapper.classList.contains(
            'vm-asymmetric-layout'
        );

        wrapper.classList.add('vm-asymmetric-layout');
        panels[0].classList.add('vm-left-panel');
        panels[0].classList.remove('vm-right-panel');
        panels[1].classList.add('vm-right-panel');
        panels[1].classList.remove('vm-left-panel');

        if (!wasApplied) {
            notifyCharts();
        }
    }

    function scheduleUpdate() {
        if (updateQueued) return;
        updateQueued = true;

        requestAnimationFrame(() => {
            updateQueued = false;
            applyOverride();
        });
    }

    const observer = new MutationObserver(scheduleUpdate);

    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['style'],
    });

    applyOverride();
})();