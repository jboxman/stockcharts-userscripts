const assert = require('node:assert/strict');

const {
    buildDeleteRequests,
    getSymbolState,
    groupFavorites,
    normalizeSymbol,
    parseFavoritesResource,
    parseStyleId,
    placeStar,
    reconcilePending,
} = require('../scripts/stockcharts-classic-focus-stars.user.js');

assert.equal(normalizeSymbol(' amd '), 'AMD');
assert.deepEqual(
    parseFavoritesResource(
        'https://stockcharts.com/json/api?' +
        'cmd=get-favorites&cc=3903632&ln=6&src=panels',
        'https://stockcharts.com'
    ),
    {
        apiOrigin: 'https://stockcharts.com',
        chartCode: 3903632,
        listNum: 6,
        url: 'https://stockcharts.com/json/api?' +
            'cmd=get-favorites&cc=3903632&ln=6&src=panels',
    }
);
assert.deepEqual(
    parseFavoritesResource(
        'https://stockcharts.com/json/api?' +
        'cmd=get-favorites&cc=3903632&ln=6&src=panels',
        'https://www.stockcharts.com'
    ),
    {
        apiOrigin: 'https://stockcharts.com',
        chartCode: 3903632,
        listNum: 6,
        url: 'https://stockcharts.com/json/api?' +
            'cmd=get-favorites&cc=3903632&ln=6&src=panels',
    }
);
assert.equal(
    parseFavoritesResource(
        'https://example.com/json/api?cmd=get-favorites&cc=1&ln=2',
        'https://stockcharts.com'
    ),
    null
);
assert.equal(
    parseFavoritesResource(
        'https://stockcharts.com/json/api?cmd=get-favorites',
        'https://stockcharts.com'
    ),
    null
);
assert.equal(parseStyleId('&id=p64721876303&p=D'), 'p64721876303');
assert.equal(parseStyleId(''), '');

const focus = groupFavorites([
    { symbol: 'AMD', recID: 10 },
    { symbol: ' amd ', recID: 11 },
    { symbol: 'IBM', recID: 12 },
    { symbol: '', recID: 13 },
    { symbol: 'MSFT', recID: 0 },
]);

assert.equal(focus.get('AMD').length, 2);
assert.equal(focus.get('IBM').length, 1);
assert.equal(focus.has('MSFT'), false);
assert.deepEqual(
    [...reconcilePending(new Set(['AMD', 'NVDA']), focus)],
    ['NVDA']
);
assert.equal(getSymbolState('AMD', new Set(), focus), 'focus');
assert.equal(getSymbolState('NVDA', new Set(['NVDA']), focus), 'pending');
assert.equal(getSymbolState('AAPL', new Set(), focus), 'none');
assert.deepEqual(buildDeleteRequests(3903632, focus.get('AMD')), [
    '/json/api?cmd=delete-favorite&chartCode=3903632&recID=10&src=panels',
    '/json/api?cmd=delete-favorite&chartCode=3903632&recID=11&src=panels',
]);

const placements = [];
placeStar({
    append() { placements.push('inside'); },
    insertAdjacentElement(position) { placements.push(position); },
}, {}, 'after-css');
assert.deepEqual(placements, ['afterend']);

console.log('StockCharts Classic Focus Stars self-check passed');
