import express from "express";
import {
  approveDeal,
  attachSseClient,
  createDealFromRequest,
  createDemoBackendState,
  denyDeal,
  forceOverCap,
  getDealOrThrow,
  listSellers,
  sendHttpError,
  serializeDeal,
  type DemoBackendState
} from "./runtime";

export function createDemoBackendApp(
  state: DemoBackendState = createDemoBackendState()
): express.Express {
  const app = express();

  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, service: "bidmesh-demo-backend" });
  });

  app.get("/api/marketplace/sellers", (_request, response) => {
    response.json({ sellers: listSellers(state) });
  });

  app.post("/api/deals", (request, response) => {
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

  app.get("/api/deals/:deal_id", (request, response) => {
    try {
      response.json(serializeDeal(getDealOrThrow(state, request.params.deal_id)));
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  app.get("/api/deals/:deal_id/events", (request, response) => {
    try {
      attachSseClient(state, request.params.deal_id, request, response);
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  app.post("/api/deals/:deal_id/approve", (request, response) => {
    try {
      response.json(serializeDeal(approveDeal(state, request.params.deal_id)));
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  app.post("/api/deals/:deal_id/deny", (request, response) => {
    try {
      response.json(serializeDeal(denyDeal(state, request.params.deal_id)));
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  app.post("/api/deals/:deal_id/force-over-cap", (request, response) => {
    try {
      response.json(serializeDeal(forceOverCap(state, request.params.deal_id)));
    } catch (error) {
      sendHttpError(response, error);
    }
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3002);
  const app = createDemoBackendApp();

  app.listen(port, () => {
    console.log(`[demo-backend] listening on http://localhost:${port}`);
  });
}
