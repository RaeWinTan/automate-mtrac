const PORT = 8000;
import express from 'express'
import {mtracRouter} from "./routes/mtrac.router";
import bodyParser from 'body-parser';
import session from "express-session";
const app = express();
app.use(bodyParser.json());
app.use("/api/mtrac", mtracRouter);
app.listen(PORT, ()=>{
  console.log(`Server started at http://localhost:${PORT}`);
});
