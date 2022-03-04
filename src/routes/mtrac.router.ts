import express, { Request, Response } from "express";
import {Credential} from "../models/mtrac";
//import { collections } from "../services/database.service";
import  { AxiosResponse, AxiosError } from 'axios';
export const mtracRouter = express.Router();
import Axios, {AxiosObservable} from  'axios-observable';
import {  catchError, first, switchMap, map, pluck} from "rxjs/operators";
import {throwError} from "rxjs";

const testLogin:string = "http://localhost:9000/mtrac/login";
const testRac:string = "http://localhost:9000/mtrac/rac";
const testHubNodeConn:string = "http://localhost:9000/mtrac/nodeHub";
//real connection strings

const loginConn:string = "https://mtrac.ternary.digital/api/auth/login";
const racConn:string = "https://mtrac.ternary.digital/api/rac";
const hubNodeConn:string =  "https://mtrac.ternary.digital/api/node/hub";

function login(credentials:Credential, timeout:number,retries:number,triesNo:number=1):AxiosObservable<any>{
  return Axios.post(loginConn,credentials,{timeout:timeout}).pipe(
    first(),
    catchError((err:AxiosError)=>{
      console.log(err.message);
      console.log(triesNo, retries);
      if(err?.response?.status === 400){
        return throwError({message:"wrong email or password", status:400});
      }
      if (triesNo > retries) return throwError({message:err.message, status:500});
      return login(credentials,timeout+1500, retries, triesNo+1);
    })
  );
}

function getNodeHub(timeout:number,retries:number,triesNo:number=1):AxiosObservable<any>{
  return Axios.get(hubNodeConn,{timeout:timeout}).pipe(
    first(),
    catchError((err:AxiosError)=>{
      if (triesNo > retries) return throwError({message:"tried too many times", status:500});
      return getNodeHub(timeout+1500, retries, triesNo+1);
    })
  );
}

const racLink = (f:any, timeout:number, authorization:string):AxiosObservable<any> => Axios.post(racConn,f, {timeout:timeout, headers:{"authorization":`${authorization}`}});
function sendRac(f:any, authorization:any, credentials:Credential, timeout:number, totalTries:number,times:number = 1):any{
  return racLink(f, timeout*times, authorization).pipe(
    first(),
    pluck("data"),
    map((x:any)=>{
      x.newAccessToken = authorization;
      return x;
    }),
    catchError((err:AxiosError)=>{
      console.log(err.response);
      if(err?.response?.status === 403){//forbiden message
        console.log("FORBIDENT MESSSAGE ");
        return login(credentials, 1000, 3).pipe(
          switchMap((v:any)=>{
              return sendRac(f, `Bearer ${v.data.accessToken}`, credentials, timeout, totalTries, times+1);
          })//here must spitout a new authorization token again so if there is an error must renew token at client side
        );
      }
      if(err?.response?.status === 400){//at the client side reiterate api/rac find for shortname === form.hub, then update the hubid then try again
        if(err.response.data.message.code === "P2025" ) return throwError({status:500, message:"resubmit nodeId", clientRetry:true});
      }
      if(err?.response?.status === 401){//weird error
        return throwError({status:500, message:err.response.data.errors});
      }
      if(times<=totalTries) return sendRac(f, authorization, credentials, timeout+1500, totalTries, times+1);
      return throwError({status:500, message:"tried too many times"})
    })
  );
}

mtracRouter.post("/rac", async(req:Request, res:Response)=>{
  console.log("/rac");
  let f:any = req.body;
  sendRac(f, req.header("authorization"), JSON.parse(req.header("credentials")), 1500, 3).subscribe(
    (data:any)=>{
      res.set("authorization",  data.newAccessToken).send(data);
    },
    (err:AxiosError|any)=>{
      console.log("axios Error /rac");
      res.status(err.status).send(err);
    });
});

mtracRouter.post("/login", async (req: Request, res: Response) => {
  console.log("/login");
  login(req.body, 1500, 3).subscribe(
      (data:AxiosResponse)=>{
        console.log("axios success /login");
        data.data.accessToken = `Bearer ${data.data.accessToken}`;
        res.send(data.data);
      },
      (err:AxiosError|any)=>{
        res.status(err.status).send(err);
      }
    );
});

mtracRouter.get("/nodeHub", async (req:Request, res:Response)=>{
  console.log("/nodehub");
  getNodeHub(1500, 3).subscribe(
    (data:AxiosResponse)=>{
      res.send(data.data);
    },
    (err:AxiosError|any)=>{
      console.log(err);
      res.status(err.status).send(err);
    }
  );
});
