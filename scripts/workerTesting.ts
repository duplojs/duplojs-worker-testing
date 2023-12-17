import {Worker} from "worker_threads";
import {ZodError, ZodType} from "zod";
import chalk from "chalk";

export type testing = {
	title: string,
	url: string,
	method: string,
	output?: string[],
	query?: Record<string, boolean | string | number | undefined>,
	params?: Record<string, boolean | string | number | undefined>,
	body?: Record<string, any> | string | FormData,
	headers?: Record<string, boolean | string | number | undefined>,
	sleepAfterRequest?: number,
	response?: {
		code?: number,
		info?: string,
		headers?: Record<string, string>,
		body?: ZodType,
	},
	afterFunction?: () => void | Promise<void>,
};

export type testError = {
	title: string,
	error: string,
};


export async function workerTesting(file: string, testing: testing[], beforReadyOutput: string[] = []){
	const thread = new Worker(
		file, 
		{
			execArgv: [
				"--require", 
				process.argv.includes("--speed") ? 
					"sucrase/register" : 
					"ts-node/register"
			],
		}
	);
	
	const testErrors: testError[] = [];
	let messages: string[] = [];

	await new Promise<void>(resolve => thread.on("message", message => {
		if(message === "ready"){
			thread.removeAllListeners("message");
			resolve();
		}
		else if(beforReadyOutput) messages.push(message);
	}));

	if(beforReadyOutput.length !== 0 || messages.length !== 0){
		console.log(chalk.bold("before ready output"));
		for(let index = 0; index < beforReadyOutput.length || index < messages.length; index++){
			if(beforReadyOutput[index] !== messages[index]){
				const log = [
					chalk.redBright("Error"), "log :", beforReadyOutput[index], "!=", messages[index]
				].join(" ");
				console.error(log);
				testErrors.push({
					title: "before ready output",
					error: log
				});
			}
			else console.log(chalk.greenBright("Valide"), "log :", beforReadyOutput[index]);
		}
		console.log("");
	}

	messages = [];
	thread.on("message", message => messages.push(message));

	for(const test of testing){
		messages = [];
		const query = Object.entries(test.query || {})
		.reduce(
			(p, [key, value]) => {
				if(value) p.push(`${key}=${value.toString()}`);
				return p;
			}, 
			[] as string[]
		)
		.join("&");

		const url = Object.entries(test.params || {}).reduce(
			(p, [key, value]) =>  value ? p.replace(`{${key}}`, value.toString()) : p,
			test.url + (query ? `?${query}` : "")
		);

		const headers = Object.entries(test.headers || {}).reduce(
			(p, [key, value]) => {
				if(typeof value !== "undefined") p[key] = value.toString();
				return p;
			}, 
			{} as Record<string, string>
		);
		
		console.log(chalk.bold(test.title));
		console.log(chalk.underline("URL"), ":", url);
		console.log(chalk.underline("METHOD"), ":", test.method);
		
		if(typeof test.body === "object" && !(test.body instanceof FormData)) test.body = JSON.stringify(test.body);

		const response = await fetch(
			url,
			{
				method: test.method,
				headers: headers,
				body: test.body
			}
		);

		const responseContentType = response.headers.get("content-type") || "";

		let result: any;
		if(responseContentType.indexOf("application/json") !== -1) result = await response.json();
		else if(responseContentType.indexOf("text/") !== -1) result = await response.text();
		else result = await response.blob();
		
		if(test.sleepAfterRequest) await new Promise<void>((res) => setTimeout(res, test.sleepAfterRequest));

		if(test.response?.code){
			if(test.response.code !== response.status){
				const log = [
					chalk.redBright("Error"), "status :", test.response.code, "!=", response.status
				].join(" ");
				console.error(log);
				testErrors.push({
					title: test.title,
					error: log
				});
			}
			else console.log(chalk.greenBright("Valide"), "status :", response.status);
		}

		if(test.response?.info){
			if(test.response.info !== response.headers.get("info")){
				const log = [
					chalk.redBright("Error"), "info :", test.response.info, "!=", response.headers.get("info")
				].join(" ");
				console.error(log);
				testErrors.push({
					title: test.title,
					error: log
				});
			}
			else console.log(chalk.greenBright("Valide"), "info :", response.headers.get("info"));
		}
		
		Object.entries(test.response?.headers || {}).forEach(([key, value]) => {
			if(response.headers.get(key) !== value){
				const log = [
					chalk.redBright("Error"), "Header :", value, "!=", response.headers.get(key)
				].join(" ");
				console.error(log);
				testErrors.push({
					title: test.title,
					error: log
				});
			}
			else console.log(chalk.greenBright("Valide"), "Header :", response.headers.get(key));
		});
		
		if(test.response?.body){
			try {
				test.response.body.parse(result);
				console.log(chalk.greenBright("Valide"), "Body");
			}
			catch (error){
				if(error instanceof ZodError){
					const log = [
						chalk.redBright("Error"), "body :", error.message, JSON.stringify(result, null, 2)
					].join(" ");
					console.error(log);
					testErrors.push({
						title: test.title,
						error: log
					});
				}
				else throw error;
			}
		}

		if(test.output){
			for(let index = 0; index < test.output.length || index < messages.length; index++){
				if(test.output[index] !== messages[index]){
					const log = [
						chalk.redBright("Error"), "log :", test.output[index], "!=", messages[index]
					].join(" ");
					console.error(log);
					testErrors.push({
						title: test.title,
						error: log
					});
				}
				else console.log(chalk.greenBright("Valide"), "log :", test.output[index]);
			}
		}

		await test.afterFunction?.();

		console.log("");
	}

	if(testErrors.length !== 0)console.error(testErrors.length, chalk.redBright.underline.bold("Errors"));
	else console.error(chalk.greenBright.underline.bold("All Is Valide"));

	await thread.terminate();

	return testErrors;
}

export type testsErrors = {
	path: string,
	tests: {
		title: string,
		errors: string[],
	}[],
};

export async function workersTesting(importer: (string: string) => Promise<any>, ...paths: string[]){
	const testsErrors: testsErrors[] = [];
	for(const path of paths){
		const {default: test} = await importer(path);
		const resultErrors = await (test as ReturnType<typeof workerTesting>);
		if(resultErrors.length !== 0){
			testsErrors.push({
				path,
				tests: Object.entries(
					resultErrors.reduce(
						(pv, v) => {
							if(!pv[v.title]) pv[v.title] = [];
							pv[v.title].push(v.error);
	
							return pv;
						},
						{} as Record<string, string[]>
					)
				)
				.map(([title, errors]) => ({title, errors}))
			});
		}
	}
	if(testsErrors.length !== 0){
		testsErrors.forEach(value => {
			console.log(value.path, ":");
			value.tests.forEach(subValue => {
				console.log(subValue.title);
				subValue.errors.forEach(error => console.error(error));
				console.log("");
			});
			console.log("");
		});
		throw new Error(chalk.redBright("TESTING ERROR"));
	}
}

