const CookieCrawler = require('./cookie-crawler');

test();

async function test() {
    const startUrl = 'https://www.also-international.eu/ec/cms5/en_2420/2420/index.jsp';
    const maxCrawlDepth = 0;
    const myCrawler = new CookieCrawler(startUrl, maxCrawlDepth);

    console.log(`Starting for: ${startUrl}`);
    console.log(`with a maximum crawl depth of: ${maxCrawlDepth}`);

    myCrawler.beforeUrlVisit(async (url, crawlDepth) => {
        console.log('Visiting:', crawlDepth, url);
    });

    myCrawler.afterUrlRendered(async (url, crawlDepth, cookies, browser) => {
        console.log('Number of cookies found so far:', cookies.length);
        return new Promise(r => setTimeout(r, 2000)); // delay
    });


    let cookies = await myCrawler.startCrawl();
    console.log('done.');
    console.log('Amount of cookies found:', cookies.length);
    console.log(cookies);
}