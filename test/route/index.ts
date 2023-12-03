import {workerTesting} from "../../scripts/workerTesting";

export default workerTesting(
	__dirname + "/route.ts",
	[
		{
			title: "hello-world",
			url: "http://localhost:1506/test/1",
			method: "GET",
			response: {
				code: 200,
				info: "s",
			}
		},
	]
);
