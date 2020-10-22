const {Builder, By, Key, until} = require('selenium-webdriver');
const ChromeDriver = require('selenium-webdriver/chrome');

const markedUrls = new Set(); // contains all URLs that have been visited, or have been enqueued for a future visit
const urlQueue = [];
const maxCrawlDepth = 3;
const foundCookies = {};
let domain = '';

startCrawl('https://www.also.com/ec/cms5/en_6000/6000/');




async function startCrawl(startUrl) {
    domain = getDomainOf(startUrl);
    console.log('Domain of start url: ', domain);
    enqueueUrl(startUrl, 0);

    let driver = await new Builder().forBrowser('chrome')
        .setChromeOptions(new ChromeDriver.Options().headless().addArguments('--log-level=3'))
        .build();
    driver.manage().deleteAllCookies();

    try {
        while(urlQueue.length > 0) {
            let nextUrlData = urlQueue.shift();
            await visitUrl(driver, nextUrlData.url, nextUrlData.crawlDepth);
        }

        console.log('Amount of visited URLs: ', markedUrls.size);
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


    // TODO: Scraping logic
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
        urls.forEach(url => enqueueUrl(url, currentCrawlDepth + 1));
    }
}

async function extractUrls(driver) {
    // Extract all url strings
    let hrefElements = await driver.findElements(By.css("a[href]"));
    let hrefUrls = await Promise.all(hrefElements.map(e => e.getAttribute('href')));

    // Remove links pointing to other domains
    let filteredUrls = hrefUrls.filter(url => url.startsWith(domain))

    // Remove anchors (everything after '#')
    .map(url => {
        let i = url.indexOf('#');
        return i > 0 ? url.substring(0, i) : url;
    })

    // Remove '.pdf' URLs
    .filter(url => !url.endsWith('.pdf'));

    // Remove duplicates
    return [...new Set(filteredUrls)];
}

function enqueueUrl(url, crawlDepth) {
    if(!markedUrls.has(url)) {
        urlQueue.push({ url, crawlDepth });
        markedUrls.add(url);
    }
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