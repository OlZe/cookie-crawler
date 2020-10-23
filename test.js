const CookieCrawler = require('./cookie-crawler');

test();

async function test() {
    let myCrawler = new CookieCrawler('https://www.also-international.eu/ec/cms5/en_2420/2420/index.jsp', 1);

    myCrawler.onUrlVisit((url, crawlDepth) => 
        console.log('Visiting: ', crawlDepth, url));

    myCrawler.afterUrlVisit((url, crawlDepth, cookies) => 
        console.log('Number of cookies: ', Object.keys(cookies).length));

    let cookies = await myCrawler.startCrawl();
    console.log('done.');
    console.log('Amount of cookies found: ', Object.keys(cookies).length);
    console.log(cookies);
}