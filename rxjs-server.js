const http = require("http");
const https = require("https");
const url = require("url");
const { from, of } = require("rxjs");
const { map, mergeMap, catchError, toArray } = require("rxjs/operators");

function getTitle(address) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(address);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    protocol
      .get(address, (res) => {
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
      });
  });
}

http
  .createServer((req, res) => {
    if (req.url.startsWith("/I/want/title")) {
      const query = url.parse(req.url, true).query;
      const addresses = Array.isArray(query.address)
        ? query.address
        : [query.address];

      from(addresses)
        .pipe(
          mergeMap((address) =>
            from(getTitle(address)).pipe(
              catchError(() => of(`${address} - NO RESPONSE`))
            )
          ),
          toArray()
        )
        .subscribe(
          (results) => {
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
          },
          (err) => {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal Server Error");
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
