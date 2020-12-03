const CookieCrawler = require('./cookie-crawler');

test();

async function test() {
    const startUrl = 'https://www.also-international.eu/ec/cms5/en_2420/2420/index.jsp';
    const maxCrawlDepth = 0;
    const myCrawler = new CookieCrawler(startUrl, maxCrawlDepth);

    console.log(`Starting for: ${startUrl}`);
    console.log(`with a maximum crawl depth of: ${maxCrawlDepth}`);

    myCrawler.onUrlVisit((url, crawlDepth) => 
        console.log('Visiting:', crawlDepth, url));

    myCrawler.afterUrlVisit((url, crawlDepth, cookies) => 
        console.log('Number of cookies found so far:', cookies.length));

    let cookies = await myCrawler.startCrawl();
    console.log('done.');
    console.log('Amount of cookies found:', cookies.length);
    console.log(cookies);
}