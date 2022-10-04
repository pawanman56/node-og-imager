
// Import and initialize the express app
const express = require('express');
const Handlebars = require('handlebars');
const Puppeteer = require('puppeteer');

const app = express();
const port = process.env.PORT || 3000;

const templateHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1' shrink-to-fit=no>
    <meta property=”og:image” content=”https://{{your_domain.com}}/ogimage?title=Open%20Graph%20Image%20Generator%20with%20NodeJS&tags[]=nodejs&tags[]=og-image&path=blog.yourdomain.com/open-graph-image-generator-with-nodejs&logoUrl={{your_logo_url}}”>
    <style>{{styles}}</style>
</head>
<body id="body">
    <main>
        <div class="logo">
            {{#if logoUrl}}
                <img src="{{logoUrl}}" alt="logo"/>
            {{else}}
                <span>Example Logo</span>
            {{/if}}
        </div>

        <div class="title">{{title}}</div>

        <div>
            {{#if tags}}
                <ul class="tags">
                    {{#each tags}}
                        <li class="tag-item">#{{this}}</li>
                    {{/each}}
                </ul>
            {{/if}}

            {{#if path}}
                <p class="path">{{path}}</p>
            {{/if}}
        </div>
    </main>
</body>
</html>
`;

const templateStyles = `
@font-face {
    font-family: Source Code Pro;
    src: url(https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@500&display=swap);
}

* {
    box-sizing: border-box;
}

:root {
    font-size: 16px;
    font-family: Source Code Pro, monospace;
}

body {
    padding: 2.5rem;
    height: 90vh;
    background: #042f7d;
    {{#if bgUrl}}
        background-image: url({{bgUrl}});
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
    {{else}}
        background: linear-gradient(to right, #042f7d, #007eff);
        color: #00ffae;
    {{/if}}
}

main {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.logo {
    width: 15rem;
    height: 3rem;
}

.logo img {
    width: 100%;
    height: 100%;
}

.logo span {
    font-size: 2rem;
    color: yellow;
    font-style: italic;
    text-decoration: wavy;
    font-variant: unicase;
}

.title {
    font-size: {{fontSize}};
    text-transform: capitalize;
    margin: 0.25rem 0;
    font-weight: bold;
}

.tags {
    display: flex;
    list-style-type: none;
    padding-left: 0;
    color: #ff00d2;
    font-size: 1.5rem;
}

.tag-item {
    margin-right: 0.5rem;
}

.path {
    color: #6dd6ff;
    font-size: 1.25rem;
}
`;

// Get dynamic font size for title depending on its length
function getFontSize(title='') {
    if (!title || typeof title !== 'string') return '';

    const titleLength = title.length;
    if (titleLength > 55) return '2.75rem';
    if (titleLength > 35) return '3.25rem';
    if (titleLength > 25) return '4.25rem';
    return '4.75rem';
}

// Setup GET endpoint
app.get('/ogimage', async (req, res) => {
    // Compile templateStyles
    const compiledStyle = Handlebars.compile(templateStyles) ({
        bgUrl: req.query.bgUrl,
        fontSize: getFontSize(req.query.title),
    });

    // Compile templateHtml
    const compiledHtml = Handlebars.compile(templateHTML) ({
        logoUrl: req.query.logoUrl,
        title: req.query.title,
        tags: req.query.tags,
        path: req.query.path,
        styles: compiledStyle,
    });

    const browser = await Puppeteer.launch({
        headless: true,
        args: ['--no-sandbox'],
        defaultViewport: {
            width: 1200,
            height: 630
        }
    });

    const page = await browser.newPage();

    // Set content to the rendered HTML
    await page.setContent(compiledHtml, { waitUntil: 'networkidle0' });

    // Wait until all images and fonts have loaded
    await page.evaluate(async () => {
        const selectors = Array.from(document.querySelectorAll('img'));

        await Promise.all([
            document.fonts.ready,
            ...selectors.map((img) => {
                // Image had already finished loading, let's see if it works
                if (img.complete) {
                    // Image loaded has presence
                    if (img.naturalHeight !== 0) return;

                    // Image failed, so it has no height
                    throw new Error('Image failed to load');
                }

                /**
                 * Image hasn't loaded
                 * add an event listener to know when it does
                 */
                return new Promise((res, rej) => {
                    img.addEventListener('load', res);
                    img.addEventListener('error', rej);
                });
            }),
        ]);
    });

    const element = await page.$('#body');
    const image = await element.screenshot({ omitBackground: true });
    await browser.close();

    res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': `immutable, no-transform, s-max-age=2592000, max-age=2592000` // 30 days cache
    });

    res.end(image);
});

// Listen for requests
app.listen(port, () => {
    console.log(`App is listening at ${port}`);
});
