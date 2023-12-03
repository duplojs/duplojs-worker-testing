import {workersTesting} from "../scripts/workerTesting";

workersTesting(
	(path) => import(path),
	__dirname + "/route",
);
