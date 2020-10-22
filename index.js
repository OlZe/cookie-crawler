const {Builder, By, Key, until} = require('selenium-webdriver');
const ChromeDriver = require('selenium-webdriver/chrome');
const UrlQueueManager = require('./url-queue-manager');
let urlQueue = null;

const maxCrawlDepth = 1;
const foundCookies = {};
let domain = '';

startCrawl('https://www.also-international.eu/ec/cms5/en_2420/2420/index.jsp');




async function startCrawl(startUrl) {
    domain = getDomainOf(startUrl);
    console.log('Domain of start url: ', domain);
    urlQueue = new UrlQueueManager(domain, maxCrawlDepth);
    urlQueue.enqueue(startUrl, 0);


    let driver = await new Builder().forBrowser('chrome')
        .setChromeOptions(new ChromeDriver.Options().headless().addArguments('--log-level=3'))
        .build();
    driver.manage().deleteAllCookies();

    try {
        while(urlQueue.hasNext()) {
            let nextUrlData = urlQueue.next();
            await visitUrl(driver, nextUrlData.url, nextUrlData.crawlDepth);
        }

        console.log('Amount of visited URLs: ', urlQueue.getMarkedUrls().length);
        console.log('Found cookies:', foundCookies);
        console.log('done');

    } catch (e) {
        console.log('EXCEPTION:\n', e);
    } finally {
        await driver.quit();
    }
}



async function visitUrl(driver, url, currentCrawlDepth) {
    console.log('Visiting: ', url);

    // Go to url
    await driver.get(url);

    // Gather cookie data
    let cookies = await driver.manage().getCookies();
    for(let cookie of cookies) {
        if(!(cookie.name in foundCookies)) {
            foundCookies[cookie.name] = {
                sourceUrl: url,
                domain: cookie.domain,
                expiry: cookie.expiry,
                value: cookie.value };
        }
    }
    console.log('Number of cookies: ', Object.keys(foundCookies).length);


    // Extract and enqueue URLs
    if(currentCrawlDepth < maxCrawlDepth) {
        let urls = await extractUrls(driver);
        urls.forEach(url => urlQueue.enqueue(url, currentCrawlDepth + 1));
    }
}

async function extractUrls(driver) {
    // Extract all url strings
    let hrefElements = await driver.findElements(By.css("a[href]"));
    return Promise.all(hrefElements.map(e => e.getAttribute('href')));
}

function getDomainOf(url) {
    // Get everything from 'http://' or 'https://' until the next '/'
    let domain = '';
    for(let prefix of ['http://', 'https://']) {
        if(url.startsWith(prefix)) {
            domain += prefix;
            url = url.replace(prefix, '');
            break;
        }
    }
    domain += url.substring(0, url.indexOf('/') + 1);
    return domain;
}