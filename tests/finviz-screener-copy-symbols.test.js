const assert = require('node:assert/strict');

global.location = {
    href: 'https://finviz.com/screener?v=111&f=cap_midover,geo_usa',
    origin: 'https://finviz.com',
};

let copied;
global.GM_setClipboard = text => {
    copied = text;
};

const responses = [
    {
        rows: [{ ticker: 'AHR' }, { ticker: 'ALAB' }],
        totalCount: 3,
    },
    {
        rows: [{ ticker: 'ARXS' }],
        totalCount: 3,
    },
];
const requestedRows = [];

global.fetch = async url => {
    requestedRows.push(Number(url.searchParams.get('firstRow')));
    return {
        ok: true,
        async json() {
            return responses.shift();
        },
    };
};

const {
    getApiUrl,
    loadSymbols,
} = require('../scripts/finviz-screener-copy-symbols.user.js');

assert.equal(
    getApiUrl(20).searchParams.get('filters'),
    'cap_midover,geo_usa'
);

(async () => {
    const count = await loadSymbols({ textContent: '' });

    assert.equal(count, 3);
    assert.deepEqual(requestedRows, [0, 2]);
    assert.equal(copied, 'AHR\nALAB\nARXS');
    console.log('Finviz userscript self-check passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
