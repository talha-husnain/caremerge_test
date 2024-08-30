import http, { IncomingMessage, ServerResponse } from "http";
import https from "https";
import { parse, UrlWithParsedQuery } from "url";
import puppeteer from "puppeteer";

// Utility function to ensure the URL has a proper protocol
function ensureHttpProtocol(address: string): string {
  if (!/^https?:\/\//i.test(address)) {
    return `http://${address}`;
  }
  return address;
}

// Function to fetch the title using HTTP/HTTPS requests
function getTitle(address: string): Promise<string> {
  return new Promise((resolve) => {
    const formattedAddress = ensureHttpProtocol(address);
    const parsedUrl = new URL(formattedAddress);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    protocol
      .get(formattedAddress, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          const titleMatch = data.match(/<title>(.*?)<\/title>/);
          if (titleMatch && titleMatch[1]) {
            resolve(`${address} - "${titleMatch[1]}"`);
          } else {
            resolve(`${address} - NO RESPONSE`);
          }
        });
      })
      .on("error", () => {
        resolve(`${address} - NO RESPONSE`);
      })
      .setTimeout(5000, () => {
        resolve(`${address} - TIMEOUT`);
      });
  });
}

// Function to fetch the title using Puppeteer for JavaScript-rendered pages
async function getTitleWithPuppeteer(address: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(address, { waitUntil: "networkidle2" });
    const title = await page.title();
    await browser.close();
    return `${address} - "${title}"`;
  } catch (err: any) {
    console.error(`Error fetching title for ${address}: ${err.message}`);
    await browser.close();
    return `${address} - NO RESPONSE`;
  }
}

// Function to fetch the title with fallback to Puppeteer
async function fetchTitle(address: string): Promise<string> {
  let title = await getTitle(address);
  if (title.includes("NO RESPONSE")) {
    title = await getTitleWithPuppeteer(address);
  }
  return title;
}

// Create an HTTP server
http
  .createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url && req.url.startsWith("/I/want/title")) {
      const parsedUrl: UrlWithParsedQuery = parse(req.url, true);
      const addresses: string[] = Array.isArray(parsedUrl.query.address)
        ? (parsedUrl.query.address as string[])
        : [parsedUrl.query.address as string];

      Promise.all(addresses.map(fetchTitle))
        .then((results) => {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
                    <html>
                    <head></head>
                    <body>
                        <h1>Following are the titles of given websites:</h1>
                        <ul>${results
                          .map((result) => `<li>${result}</li>`)
                          .join("")}</ul>
                    </body>
                    </html>
                `);
        })
        .catch(() => {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error");
        });
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    }
  })
  .listen(3000, () => {
    console.log("Server is running on port 3000");
  });
