const {Builder, By, Key, until} = require('selenium-webdriver');
const visitedUrls = new Set(); // contains all URLs that have been visited, or have been enqueued for a future visit
const urlQueue = [];
const maxCrawlDepth = 2;
let domain = '';

startCrawl('https://www.also.com/ec/cms5/en_6000/6000/');




async function startCrawl(startUrl) {
    domain = getDomainOf(startUrl);
    console.log('Domain of start url: ', domain);
    enqueueUrl(startUrl, 0);

    let driver = await new Builder().forBrowser('chrome').build();
    try {
        while(urlQueue.length > 0) {
            let nextUrlData = urlQueue.shift();
            await visitUrl(driver, nextUrlData.url, nextUrlData.crawlDepth);
        }

        console.log('done');
        console.log('queue: ', urlQueue);
        console.log('visited URLs:', visitedUrls);
        console.log('Amount of visited URLs: ', visitedUrls.size);

    } catch (e) {
        console.log('EXCEPTION:\n', e);
    } finally {
        await driver.quit();
    }
}



async function visitUrl(driver, url, currentCrawlDepth) {
    // Go to url
    await driver.get(url);

    // Get crawlable links
    if(currentCrawlDepth < maxCrawlDepth) {
        let hrefElements = await driver.findElements(By.css("a[href]"));
        let hrefUrls = await Promise.all(hrefElements.map(e => e.getAttribute('href')));
        let crawlableUrls = hrefUrls.filter(url => url.startsWith(domain));

        // enqueue crawlable links
        crawlableUrls.forEach(url => enqueueUrl(url, currentCrawlDepth + 1));
    }
}

function enqueueUrl(url, crawlDepth) {
    if(!visitedUrls.has(url)) {
        urlQueue.push({ url, crawlDepth });
        visitedUrls.add(url);
    }
}

function getDomainOf(url) {
    // Get everything from 'http://' or 'https://' until the next '/'
    let domain = '';
    for(prefix of ['http://', 'https://']) {
        if(url.startsWith(prefix)) {
            domain += prefix;
            url = url.replace(prefix, '');
            break;
        }
    }
    domain += url.substring(0, url.indexOf('/') + 1);
    return domain;
}