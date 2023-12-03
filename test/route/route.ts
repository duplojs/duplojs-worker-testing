import Duplo, {zod} from "@duplojs/duplojs";
import {parentPort} from "worker_threads";

const duplo = Duplo({port: 1506, host: "localhost"});

duplo.declareRoute("GET", "/test/1")
.handler(({}, res) => res.code(200).info("s").send());

duplo.launch(() => parentPort?.postMessage("ready"));
