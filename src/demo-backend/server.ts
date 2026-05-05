import express from "express";
import path from "node:path";
import {
  approveDeal,
  attachSseClient,
  createDealFromRequest,
  createDemoBackendState,
  denyDeal,
  forceOverCap,
  getDealOrThrow,
  listDeals,
  listSellers,
  sendHttpError,
  serializeDeal,
  type DemoBackendState
} from "./runtime";

export function createDemoBackendApp(
  state: DemoBackendState = createDemoBackendState()
): express.Express {
  const app = express();
  const routeParam = (value: string | string[]): string => Array.isArray(value) ? value[0] : value;
  const bidmeshRoot = path.resolve(process.cwd(), "bidmesh");
  const sharedUiRoot = path.join(bidmeshRoot, "ui_kits");
  const humanUiRoot = path.join(bidmeshRoot, "ui_kits", "human");
  const agentUiRoot = path.join(bidmeshRoot, "ui_kits", "agent");

  app.use(express.json());
  app.get("/ui/human/landing.html", (_request, response) => {
    response.sendFile("landing.html", { root: sharedUiRoot });
  });

  app.get("/ui/agent/landing.html", (_request, response) => {
    response.sendFile("landing.html", { root: sharedUiRoot });
  });

  app.use("/bidmesh", express.static(bidmeshRoot));
  app.use("/ui/human", express.static(humanUiRoot));
  app.use("/ui/agent", express.static(agentUiRoot));

  app.get("/", (_request, response) => {
    response.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BidMesh Demo Backend</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 40px; line-height: 1.5; }
    code { background: #f3f3f3; padding: 2px 6px; border-radius: 4px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h1>BidMesh Demo Backend</h1>
  <p>This server exposes the imported dev2 marketplace backend plus static UI kits.</p>
  <ul>
    <li><a href="/api/health">/api/health</a></li>
    <li><a href="/api/marketplace/sellers">/api/marketplace/sellers</a></li>
    <li><a href="/ui/human/">/ui/human/</a> for the buyer-facing mock UI</li>
    <li><a href="/ui/agent/">/ui/agent/</a> for the agent-facing mock UI</li>
    <li><a href="/bidmesh/">/bidmesh/</a> for the imported design assets</li>
  </ul>
</body>
</html>`);
  });

  app.get("/ui/human", (_request, response) => {
    response.sendFile("index.html", { root: humanUiRoot });
  });

  app.get("/ui/agent", (_request, response) => {
    response.sendFile("index.html", { root: agentUiRoot });
  });

  app.get(["/api/health", "/health"], (_request, response) => {
    response.json({ ok: true, service: "bidmesh-demo-backend" });
  });

  app.get(["/api/marketplace/sellers", "/marketplace/sellers"], (_request, response) => {
    response.json({ sellers: listSellers(state) });
  });

  app.get(["/api/deals", "/deals"], (_request, response) => {
    response.json({ deals: listDeals(state) });
  });

  app.post(["/api/deals", "/deals"], (request, response) => {
    try {
      const record = createDealFromRequest(state, request.body);

      response.status(201).json({
        deal_id: record.deal.deal_id,
        phase: record.phase,
        events_url: `/api/deals/${record.deal.deal_id}/events`
      });
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  app.get(["/api/deals/:deal_id", "/deals/:deal_id"], (request, response) => {
    try {
      response.json(serializeDeal(getDealOrThrow(state, routeParam(request.params.deal_id))));
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  app.get(["/api/deals/:deal_id/events", "/deals/:deal_id/events"], (request, response) => {
    try {
      attachSseClient(state, routeParam(request.params.deal_id), request, response);
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  app.post(["/api/deals/:deal_id/approve", "/deals/:deal_id/approve"], (request, response) => {
    try {
      response.json(serializeDeal(approveDeal(state, routeParam(request.params.deal_id))));
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  app.post(["/api/deals/:deal_id/deny", "/deals/:deal_id/deny"], (request, response) => {
    try {
      response.json(serializeDeal(denyDeal(state, routeParam(request.params.deal_id))));
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  app.post(
    ["/api/deals/:deal_id/force-over-cap", "/deals/:deal_id/force-over-cap"],
    (request, response) => {
    try {
      response.json(serializeDeal(forceOverCap(state, routeParam(request.params.deal_id))));
    } catch (error) {
      sendHttpError(response, error);
    }
    }
  );

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3002);
  const app = createDemoBackendApp();

  app.listen(port, () => {
    console.log(`[demo-backend] listening on http://localhost:${port}`);
  });
}
