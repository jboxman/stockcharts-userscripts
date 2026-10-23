const assert = require('node:assert/strict');

const {
    buildFilename,
    findDownloadAction,
    isCaptureShortcut,
    renamePngDownload,
    sanitizeFilenamePart,
} = require('../scripts/stockcharts-acp-download-chart.user.js');

assert.equal(isCaptureShortcut({
    code: 'KeyC',
    altKey: true,
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
}), true);

assert.equal(isCaptureShortcut({
    code: 'KeyC',
    altKey: false,
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
}), false);

const labelAction = {
    textContent: ' Download Chart as PNG ',
    getAttribute() { return null; },
};
const delegateAction = {
    textContent: '',
    getAttribute(name) {
        return name === 'click.delegate' ? 'handleDownloadChart($event)' : null;
    },
};

assert.equal(findDownloadAction({
    querySelectorAll() { return [labelAction, delegateAction]; },
}), delegateAction);

assert.equal(
    sanitizeFilenamePart(' Swing / Entry: AAPL? '),
    'Swing - Entry- AAPL-'
);

assert.equal(buildFilename({
    layoutName: 'Swing Entry',
    symbols: ['AAPL', 'MSFT'],
    date: new Date(2026, 9, 20, 14, 30, 22),
}), 'Swing Entry--AAPL-MSFT--2026-10-20_143022.png');

const pngDownload = {
    download: 'AAPL.png',
    href: 'data:image/png;base64,abc',
};

assert.equal(renamePngDownload(pngDownload, 'custom.png'), true);
assert.equal(pngDownload.download, 'custom.png');
assert.equal(renamePngDownload({
    download: 'report.pdf',
    href: 'data:application/pdf;base64,abc',
}, 'custom.png'), false);

console.log('StockCharts download shortcut self-check passed');
