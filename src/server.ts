import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
// @ts-ignore
app.options("*", cors());
app.use(cors());

app.get("/", (req, res) => {
  res.send({ ok: true });
});

// @ts-ignore
app.use((err, req, res, next) => {
  const { status, ...body } = err;
  res.status(status || 500).send(body);
});

app.listen(process.env.PORT || 3000);
