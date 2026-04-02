import express from "express";
import serverApp from "./server/app.js";

const app = express();
app.use(serverApp);

export default app;
