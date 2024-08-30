import http, { IncomingMessage, ServerResponse } from "http";
import { parse, UrlWithParsedQuery } from "url";
import puppeteer from "puppeteer";
import async from "async";

function isValidUrl(address: string): boolean {
  try {
    new URL(address);
    return true;
  } catch {
    return false;
  }
}

function ensureHttpProtocol(address: string): string {
  if (!/^https?:\/\//i.test(address)) {
    return `http://${address}`;
  }
  return address;
}

async function getTitleWithPuppeteer(address: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(address, { waitUntil: "networkidle2" });
    const title = await page.title();
    await browser.close();
    return `${address} - "${title}"`;
  } catch (err:any) {
    console.error(`Error fetching title for ${address}: ${err.message}`);
    await browser.close();
    return `${address} - NO RESPONSE`;
  }
}

http
  .createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url && req.url.startsWith("/I/want/title")) {
      const parsedUrl: UrlWithParsedQuery = parse(req.url, true);
      const addresses: string[] = Array.isArray(parsedUrl.query.address)
        ? (parsedUrl.query.address as string[])
        : [parsedUrl.query.address as string];

      async.map(
        addresses,
        async (address: string, callback) => {
          if (isValidUrl(ensureHttpProtocol(address))) {
            const title = await getTitleWithPuppeteer(
              ensureHttpProtocol(address)
            );
            callback(null, title);
          } else {
            callback(null, `${address} - INVALID URL`);
          }
        },
        (err, results) => {
          if (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal Server Error");
            return;
          }

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
                <html>
                <head></head>
                <body>
                    <h1>Following are the titles of given websites:</h1>
                    <ul>${results
                      ?.map((result) => `<li>${result}</li>`)
                      .join("")}</ul>
                </body>
                </html>
            `);
        }
      );
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    }
  })
  .listen(3000, () => {
    console.log("Server is running on port 3000");
  });
