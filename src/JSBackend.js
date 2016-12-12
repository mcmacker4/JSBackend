
const http = require("http");
const vm = require("vm");
const fs = require("fs");
const url = require("url");
const qs = require("querystring");

const server = http.createServer((req, res) => {

    let parsedUrl = url.parse(req.url, true);
    let filePath = "./var" + parsedUrl.pathname;
    if(fs.fstatSync(fs.openSync(filePath, 'r+')).isDirectory())
        filePath += (filePath.endsWith("/") ? "" : "/") + "index.html";

    console.log(filePath);

    fs.readFile(filePath, "utf8", (err, data) => {

        if(err && err.errno == -4058) {
            res.writeHead(404, "Not Found", { "Content-Type": "text/html" });
            res.end("<h1>Not Found</h1><br>The page you requested does not exist.");
            return;
        }

        let requestBody = "";
        req.on("data", (data) => {
            requestBody += data;
            if(requestBody.length > 1e6)
                req.connection.destroy();
        });

        req.on("end", () => {

            let sandbox = {
                _OUTPUT: "",
                GET: {},
                POST: {},
                SERVER: {}
            };

            sandbox.GET = parsedUrl.query;
            if(req.method == "POST")
                sandbox.POST = qs.parse(requestBody);

            vm.createContext(sandbox);
            vm.runInContext("function write(data) { _OUTPUT += data.toString(); }", sandbox);

            const regex = /<\?js([\s\S]+?)\?>/img;

            data = data.replace(regex, (match) => {
                if(match === null) return "MATCHING FUNCTION GOT NULL";

                match = match.replace("<?js", "");
                match = match.replace("?>", "");
                match = match.trim();

                try {
                    vm.runInContext(match, sandbox);
                } catch (error) {
                    console.log(error)
                }

                let result = sandbox["_OUTPUT"];
                sandbox["_OUTPUT"] = "";

                return result;

            });

            res.end(data);

        });
    });
});

server.listen(1337);
