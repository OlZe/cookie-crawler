const {Builder, By, Key, until} = require('selenium-webdriver');
const ChromeDriver = require('selenium-webdriver/chrome');
const UrlQueueManager = require('./url-queue-manager');

class CookieCrawler {

    constructor(startUrl, maxCrawlDepth) {
        this._startUrl = startUrl;
        this._maxCrawlDepth = maxCrawlDepth;
        this._domain = this._getDomainOf(startUrl);
        this._urlQueue = new UrlQueueManager(this._domain, maxCrawlDepth);
        this._foundCookies = {};
    }

    async startCrawl() {
        this._urlQueue.enqueue(this._startUrl, 0);


        let driver = await new Builder().forBrowser('chrome')
            .setChromeOptions(new ChromeDriver.Options().headless().addArguments('--log-level=3'))
            .build();
        driver.manage().deleteAllCookies();

        try {
            while(this._urlQueue.hasNext()) {
                let nextUrlData = this._urlQueue.next();
                await this._visitUrl(driver, nextUrlData.url, nextUrlData.crawlDepth);
            }

            console.log('Amount of visited URLs: ', this._urlQueue.getMarkedUrls().length);
            console.log('Found cookies:', this._foundCookies);
            console.log('done');

        } catch (e) {
            console.log('EXCEPTION:\n', e);
        } finally {
            await driver.quit();
        }
    }

    async _visitUrl(driver, url, currentCrawlDepth) {
        console.log('Visiting: ', url);

        // Go to url
        await driver.get(url);

        // Gather cookie data
        let cookies = await driver.manage().getCookies();
        for(let cookie of cookies) {
            if(!(cookie.name in this._foundCookies)) {
                this._foundCookies[cookie.name] = {
                    sourceUrl: url,
                    domain: cookie.domain,
                    expiry: cookie.expiry,
                    value: cookie.value };
            }
        }
        console.log('Number of cookies: ', Object.keys(this._foundCookies).length);


        // Extract and enqueue URLs
        if(currentCrawlDepth < this._maxCrawlDepth) {
            let urls = await this._extractUrls(driver);
            urls.forEach(url => this._urlQueue.enqueue(url, currentCrawlDepth + 1));
        }
    }

    async _extractUrls(driver) {
        // Extract all url strings
        let hrefElements = await driver.findElements(By.css("a[href]"));
        return Promise.all(hrefElements.map(e => e.getAttribute('href')));
    }

    _getDomainOf(url) {
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
}

module.exports = CookieCrawler