import http from "node:http";

const MODELS = [
  { name: "mistral:latest", size: 3825819519 },
  { name: "deepseek-coder:latest", size: 776123456 },
];

const MODEL_DETAILS = {
  "mistral:latest": {
    name: "mistral:latest",
    details: { family: "mistral", parameter_size: "7B" },
  },
  "deepseek-coder:latest": {
    name: "deepseek-coder:latest",
    details: { family: "deepseek", parameter_size: "6.7B" },
  },
};

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

export function startFakeOllama(port = 11435) {
  const PORT = port;
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/api/tags") {
        sendJson(res, 200, { models: MODELS });
        return;
      }

      if (req.method === "POST" && req.url === "/api/generate") {
        const body = await readJsonBody(req);
        sendJson(res, 200, {
          model: body.model,
          response: `Mock OLLAMA response for: ${body.prompt ?? ""}`,
          total_duration: 1000000,
        });
        return;
      }

      if (req.method === "POST" && req.url === "/api/show") {
        const body = await readJsonBody(req);
        const model = MODEL_DETAILS[body.name];
        if (!model) {
          sendJson(res, 404, { error: "model not found" });
          return;
        }
        sendJson(res, 200, model);
        return;
      }

      if (req.method === "POST" && req.url === "/api/pull") {
        sendJson(res, 200, { status: "success" });
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve({
        server,
        endpoint: `http://localhost:${PORT}`,
        close() {
          return new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          });
        },
      });
    });
  });
}
