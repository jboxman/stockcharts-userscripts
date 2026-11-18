const assert = require('node:assert/strict');

const {
    isStyleScopeCurrent,
    rewriteStyleUrl,
} = require('../scripts/stockcharts-classic-chart-styles.user.js');

const daily = {
    id: 'p24166688785',
    parameters: { p: 'D', b: '5', g: '2' },
};
const weekly = {
    id: 'p92783674841',
    parameters: { p: 'W', b: '5', g: '2' },
};

assert.equal(
    rewriteStyleUrl(
        '/c-sc/sc?s=GKOS&p=W&b=5&g=0&i=p39385627051&' +
            'a=2394004689&r=1&v=svg',
        daily,
        123,
        'https://stockcharts.com'
    ),
    'https://stockcharts.com/c-sc/sc?' +
        's=GKOS&p=D&b=5&g=2&i=p24166688785&' +
        'a=2394004689&r=123&v=svg'
);
assert.equal(
    rewriteStyleUrl(
        '/c-sc/sc?s=GKOS&p=D&b=5&g=0&id=p39385627051&' +
            'a=2394004689&r=1&v=svg',
        weekly,
        123,
        'https://stockcharts.com'
    ),
    'https://stockcharts.com/c-sc/sc?' +
        's=GKOS&p=W&b=5&g=2&id=p92783674841&' +
        'a=2394004689&r=123&v=svg'
);
assert.equal(
    rewriteStyleUrl(
        '/c-sc/sc?s=GKOS&p=W&b=5&g=2&id=p92783674841&' +
            'a=2394004689&r=1&v=svg',
        weekly,
        123,
        'https://stockcharts.com'
    ),
    '/c-sc/sc?s=GKOS&p=W&b=5&g=2&id=p92783674841&' +
        'a=2394004689&r=1&v=svg'
);
assert.equal(
    rewriteStyleUrl('/images/logo.svg', daily, 123),
    '/images/logo.svg'
);
assert.equal(
    isStyleScopeCurrent(
        'https://stockcharts.com/panels/?listNum=7',
        'https://stockcharts.com/panels/?listNum=7'
    ),
    true
);
assert.equal(
    isStyleScopeCurrent(
        'https://stockcharts.com/panels/?listNum=7',
        'https://stockcharts.com/panels/?listNum=8'
    ),
    false
);

console.log('StockCharts Classic Chart Styles self-check passed');
